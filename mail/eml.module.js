/*
La libreria è stata creata sulla base della seguente libreria https://github.com/papnkukn/eml-format
*/

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.buildEml = factory();
  }
}(this, function () {

  /******************************************************************************************
   * Parses EML file content and return user-friendly object.
   * @params data        EML structure
   * @params options     EML build options
   * @params callback    Callback function(error, data)
   ******************************************************************************************/
  return buildEml = (data, options, callback) => {
    /*return async function buildEml(data, options, callback) {*/
    //Default character set
    var defaultCharset = 'utf-8'; //to use if charset=... is missing

    //Gets the character encoding name for iconv, e.g. 'iso-8859-2' -> 'iso88592'
    function getCharsetName(charset) {
      return charset.toLowerCase().replace(/[^0-9a-z]/g, "");
    }

    //Generates a random id
    function guid() {
      return 'xxxxxxxxxxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      }).replace("-", "");
    }

    //Word-wrap the string 's' to 'i' chars per row
    function wrap(s, i) {
      var a = [];
      do { a.push(s.substring(0, i)) }
      while ((s = s.substring(i, s.length)) != "");
      return a.join("\r\n");
    }

    //Overridable properties and functions
    var emlformat = {
      verbose: false,
      fileExtensions: {
        "text/plain": ".txt",
        "text/html": ".html",
        "image/png": ".png",
        "image/jpg": ".jpg",
        "image/jpeg": ".jpg",
      },
      //Gets file extension by mime type
      getFileExtension: function (mimeType) {
        return emlformat.fileExtensions[mimeType] || "";
      },
      //Gets the boundary name
      getBoundary: function (contentType) {
        var match = /boundary="?(.+?)"?(\s*;[\s\S]*)?$/g.exec(contentType);
        return match ? match[1] : undefined;
      },
      //Gets character set name, e.g. contentType='.....charset="iso-8859-2"....'
      getCharset: function (contentType) {
        var match = /charset\s*=\W*([\w\-]+)/g.exec(contentType);
        return match ? match[1] : undefined;
      },
      //Gets name and e-mail address from a string, e.g. "PayPal" <noreply@paypal.com> => { name: "PayPal", email: "noreply@paypal.com" }
      getEmailAddress: function (raw) {
        var list = [];

        //Split around ',' char
        //var parts = raw.split(/,/g); //Will also split ',' inside the quotes
        //var parts = raw.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g); //Ignore ',' within the double quotes
        var parts = raw.match(/("[^"]*")|[^,]+/g); //Ignore ',' within the double quotes

        for (var i = 0; i < parts.length; i++) {
          var address = {};

          //Quoted name but without the e-mail address
          if (/^".*"$/g.test(parts[i])) {
            address.name = emlformat.unquoteString(parts[i]).replace(/"/g, "").trim();
            i++; //Shift to another part to capture e-mail address
          }

          var regex = /^(.*?)(\s*\<(.*?)\>)$/g;
          var match = regex.exec(parts[i]);
          if (match) {
            var name = emlformat.unquoteString(match[1]).replace(/"/g, "").trim();
            if (name && name.length) {
              address.name = name;
            }
            address.email = match[3].trim();
            list.push(address);
          }
          else {
            //E-mail address only (without the name)
            address.email = parts[i].trim();
            list.push(address);
          }
        }

        //Return result
        if (list.length == 0) {
          return null; //No e-mail address
        }
        if (list.length == 1) {
          return list[0]; //Only one record, return as object, required to preserve backward compatibility
        }
        return list; //Multiple e-mail addresses as array
      },
      //Builds e-mail address string, e.g. { name: "PayPal", email: "noreply@paypal.com" } => "PayPal" <noreply@paypal.com>
      toEmailAddress: function (data) {
        var email = "";
        if (typeof data == "undefined") {
          //No e-mail address
        }
        else if (typeof data == "string") {
          email = data;
        }
        else if (typeof data == "object") {
          if (Array.isArray(data)) {
            for (var i = 0; i < data.length; i++) {
              email += (email.length ? ', ' : '');
              if (data[i].name) {
                email += '"' + data[i].name + '"';
              }
              if (data[i].email) {
                email += (email.length ? ' ' : '') + '<' + data[i].email + '>';
              }
            }
          }
          else {
            if (data.name) {
              email += '"' + data.name + '"';
            }
            if (data.email) {
              email += (email.length ? ' ' : '') + '<' + data.email + '>';
            }
          }
        }
        return email;
      },
      //Decodes string by detecting the charset
      unquoteString: function (s) {
        var regex = /=\?([^?]+)\?(B|Q)\?(.+?)(\?=)/gi;
        var match = regex.exec(s);
        if (match) {
          var charset = getCharsetName(match[1] || defaultCharset); //eq. match[1] = 'iso-8859-2'; charset = 'iso88592'
          var type = match[2].toUpperCase();
          var value = match[3];
          if (type == "B") { //Base64
            if (charset == "utf8") {
              return Buffer.from(value.replace(/\r?\n/g, ""), "base64").toString("utf8");
            }
            else {
              return iconv.decode(Buffer.from(value.replace(/\r?\n/g, ""), "base64"), charset);
            }
          }
          else if (type == "Q") { //Quoted printable
            return emlformat.unquotePrintable(value, charset);
          }
        }
        return s;
      },
      //Decodes string like =?UTF-8?B?V2hhdOKAmXMgeW91ciBvbmxpbmUgc2hvcHBpbmcgc3R5bGU/?= or =?UTF-8?Q?...?=
      unquoteUTF8: function (s) {
        var regex = /=\?UTF\-8\?(B|Q)\?(.+?)(\?=)/gi;
        var match = regex.exec(s);
        if (match) {
          var type = match[1].toUpperCase();
          var value = match[2];
          if (type == "B") { //Base64
            return Buffer.from(value.replace(/\r?\n/g, ""), "base64").toString("utf8");
          }
          else if (type == "Q") { //Quoted printable
            return emlformat.unquotePrintable(value);
          }
        }
        return s;
      },
      //Decodes "quoted-printable"
      unquotePrintable: function (s, charset) {
        //Convert =0D to '\r', =20 to ' ', etc.
        if (!charset || charset == "utf8" || charset == "utf-8") {
          return s
            .replace(/=([\w\d]{2})=([\w\d]{2})=([\w\d]{2})/gi, function (matcher, p1, p2, p3, offset, string) { return Buffer.from([parseInt(p1, 16), parseInt(p2, 16), parseInt(p3, 16)]).toString("utf8"); })
            .replace(/=([\w\d]{2})=([\w\d]{2})/gi, function (matcher, p1, p2, offset, string) { return Buffer.from([parseInt(p1, 16), parseInt(p2, 16)]).toString("utf8"); })
            .replace(/=([\w\d]{2})/gi, function (matcher, p1, offset, string) { return String.fromCharCode(parseInt(p1, 16)); })
            .replace(/=\r?\n/gi, ""); //Join line
        }
        else {
          return s
            .replace(/=([\w\d]{2})=([\w\d]{2})/gi, function (matcher, p1, p2, offset, string) { return iconv.decode(Buffer.from([parseInt(p1, 16), parseInt(p2, 16)]), charset); })
            .replace(/=([\w\d]{2})/gi, function (matcher, p1, offset, string) { return iconv.decode(Buffer.from([parseInt(p1, 16)]), charset); })
            .replace(/=\r?\n/gi, ""); //Join line
        }
      },
      arrayBufferToBase64: (buffer) => {
        var binary = '';
        var bytes = new Uint8Array(buffer);
        var len = bytes.byteLength;
        for (var i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      }
    };



    //Shift arguments
    if (typeof options == "function" && typeof callback == "undefined") {
      callback = options;
      options = null;
    }

    if (typeof callback != "function") {
      callback = function (error, result) { };
    }

    var eml = "";
    var EOL = "\r\n"; //End-of-line

    try {
      if (!data || typeof data != "object") {
        throw new Error("Argument 'data' expected to be an object!");
      }

      if (!data.headers) {
        data.headers = {};
      }

      if (typeof data.subject == "string") {
        data.headers["Subject"] = data.subject;
      }

      if (typeof data.from != "undefined") {
        data.headers["From"] = (typeof data.from == "string" ? data.from : emlformat.toEmailAddress(data.from));
      }

      if (typeof data.to != "undefined") {
        data.headers["To"] = (typeof data.to == "string" ? data.to : emlformat.toEmailAddress(data.to));
      }

      if (typeof data.cc != "undefined") {
        data.headers["Cc"] = (typeof data.cc == "string" ? data.cc : emlformat.toEmailAddress(data.cc));
      }

      //X-Unsent: 1
      data.headers["X-Unsent"] = "1";

      //X-Priority: 1
      data.headers["X-Priority"] = "1";

      if (!data.headers["To"]) {
        throw new Error("Missing 'To' e-mail address!");
      }

      var boundary = "----=" + guid();
      if (typeof data.headers["Content-Type"] == "undefined") {
        data.headers["Content-Type"] = 'multipart/mixed;' + EOL + 'boundary="' + boundary + '"';
      }
      else {
        var name = emlformat.getBoundary(data.headers["Content-Type"]);
        if (name) {
          boundary = name;
        }
      }

      //Build headers
      var keys = Object.keys(data.headers);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = data.headers[key];
        if (typeof value == "undefined") {
          continue; //Skip missing headers
        }
        else if (typeof value == "string") {
          eml += key + ": " + value.replace(/\r?\n/g, EOL + "  ") + EOL;
        }
        else { //Array
          for (var j = 0; j < value.length; j++) {
            eml += key + ": " + value[j].replace(/\r?\n/g, EOL + "  ") + EOL;
          }
        }
      }

      //Start the body
      eml += EOL;

      //Plain text content
      if (data.text && data.html === undefined) { //"data.html === undefined" cosi non viene create il file txt se è presente html
        eml += "--" + boundary + EOL;
        eml += "Content-Type: text/plain; charset=utf-8" + EOL;
        eml += EOL;
        eml += data.text;
        eml += EOL + EOL;
      }

      //HTML content
      if (data.html) {
        eml += "--" + boundary + EOL;
        eml += "Content-Type: text/html; charset=utf-8" + EOL;
        eml += EOL;
        eml += data.html;
        eml += EOL + EOL;
      }

      //Append attachments
      if (data.attachments) {
        (data.attachments).forEach(async attachment => {
          eml += '--' + boundary + EOL;
          eml += 'Content-Type: ' + (attachment.contentType || "application/octet-stream") + EOL;
          eml += 'Content-Transfer-Encoding: base64' + EOL;
          eml += 'Content-Disposition: ' + (attachment.inline ? "inline" : "attachment") + '; filename="' + (attachment.filename || attachment.name || ("attachment_" + (i + 1))) + '"' + EOL;
          if (attachment.cid) {
            eml += 'Content-ID: <' + attachment.cid + ">" + EOL;
          }
          eml += EOL;
          if (attachment.data && (attachment.data).constructor === String) {
            var content = window.btoa(attachment.data);
            eml += wrap(content, 76) + EOL;
          }
          if (attachment.data && (attachment.data).constructor === ArrayBuffer) {
            var content = emlformat.arrayBufferToBase64(attachment.data)
            eml += wrap(content, 76) + EOL;
          }
          /*
          if (attachment.data && (attachment.data).constructor === Blob) {
            console.log("attachment-Blob");
          }
          if (attachment.url) {
            const arrayBuffer = await fetch(attachment.url).then(res => res.arrayBuffer());
            var content = emlformat.arrayBufferToBase64(arrayBuffer)
  
            eml += wrap(content, 76) + EOL;
          }*/
          eml += EOL;
        });
      }

      //Finish the boundary
      eml += "--" + boundary + "--" + EOL;

      callback(null, eml);
    }
    catch (e) {
      callback(e);
    }
  };
}));
