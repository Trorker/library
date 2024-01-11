/*
La libreria è stata creata sulla base della seguente libreria https://github.com/vloth/emails-input
*/
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD. Register as an anonymous module.
    define([], factory);
  } else if (typeof exports === 'object') {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory(require('./utils')); // Assuming utils module is required here
  } else {
    // Browser globals (root is window)
    root.EmailsInput = factory(root.utils);
  }
}(this, function (utils) {

  const keycode = { comma: 44, enter: 13, backspace: 8 };

  const EmailsInput = function (inputContainerNode, options) {
    this._options = buildOptions(options);
    this._listeners = setEventListeners(inputContainerNode, this._options);
    this._inputContainerNode = inputContainerNode;

    init(inputContainerNode, this._options);
  };

  EmailsInput.prototype.add = function add(email) {
    const refElement = this._inputContainerNode.querySelector('input');
    addChip(refElement, email);
  };

  EmailsInput.prototype.remove = function remove(email) {
    getChips(this._inputContainerNode)
      .filter(function (chip) { return chip.firstChild.textContent === email; })
      .forEach(function (chip) { chip.remove(); });
  };

  EmailsInput.prototype.getValue = function getValue(options) {
    const chips = getChips(this._inputContainerNode);
    const includeInvalid = (options || {}).includeInvalid || false;

    if (includeInvalid)
      return chips.map(function (chip) { return chip.firstChild.textContent; });

    return chips
      .filter(function (chip) { return !chip.classList.contains('invalid'); })
      .map(function (chip) { return chip.firstChild.textContent; });
  };

  EmailsInput.prototype.destroy = function destroy() {
    const inputContainerNode = this._inputContainerNode;
    inputContainerNode.innerHTML = '';
    this._listeners.forEach(function (listener) {
      inputContainerNode.removeEventListener(listener.event, listener.handler, false);
    });
    this._listeners = [];
  };

  return function () {
    const instance = Object.create(EmailsInput.prototype);
    EmailsInput.apply(instance, Array.prototype.slice.call(arguments));
    return instance;
  };

  function init(inputContainerNode, options) {
    inputContainerNode.innerHTML = ' \
      <div class="emails emails-input"> \
        <input type="text" role="emails-input" placeholder="' + options.placeholder + '"> \
      </div> \
    ';

    //Add css
    var D = document;
    if (!D.getElementById("EmailsInput")) {
      var newNode = D.createElement('style');
      newNode.setAttribute("id", "EmailsInput");
      newNode.textContent = ".emails.emails-input{max-height:inherit;box-sizing:border-box;line-height:1.5rem;cursor:text;overflow:auto}.emails.emails-input .email-chip{box-sizing:border-box;position:relative;display:inline-block;background:rgba(255,15,100,.2);vertical-align:top;border-radius:6.25rem;padding-left:.625rem;padding-right:1.5rem;margin:.125rem;max-width:100%;overflow:hidden}.emails.emails-input .email-chip .content{display:inline-block;vertical-align:top;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.emails.emails-input .email-chip .remove{text-decoration:none;color:inherit;text-align:center;position:absolute;cursor:pointer;width:1rem;font-size:1rem;user-select:none;-moz-user-select:none;-khtml-user-select:none;-webkit-user-select:none;-o-user-select:none}.emails.emails-input .email-chip.invalid{background:#fff;border-bottom:1px dashed #d92929;border-radius:0;padding-left:0;padding-right:1rem}.emails.emails-input input{border:0;line-height:inherit;font-size:inherit;color:inherit;margin:.125rem}.emails.emails-input input:-ms-input-placeholder,.emails.emails-input input::-ms-input-placeholder,.emails.emails-input input::placeholder{color:#c3c2cf;opacity:1}.emails.emails-input input:focus{outline:0}";
  
      var targ = D.getElementsByTagName('head')[0] || D.body || D.documentElement;
      targ.appendChild(newNode);
    }
  }

  function buildOptions(givenOptions) {
    const options = givenOptions || {};
    options.placeholder = options.placeholder || 'add more people ...';
    options.triggerKeyCodes = options.triggerKeyCodes || [keycode.enter, keycode.comma];
    options.pasteSplitPattern = options.pasteSplitPattern || /(?:,| )+/;
    return options;
  }

  function getChips(inputContainerNode) {
    return Array.prototype.slice
      .call(inputContainerNode.querySelectorAll('.emails-input .email-chip'));
  }

  function addChip(refElement, email) {
    const trimmedEmail = email && email.trim();
    if (!trimmedEmail) return;

    const chip = document.createElement('span');
    chip.setAttribute('role', 'email-chip');
    chip.classList.add('email-chip');
    if (!isValidEmail(trimmedEmail))
      chip.classList.add('invalid');

    chip.innerHTML = '<span class="content">'
      + trimmedEmail + '</span><a href="#" class="remove">×</a>';

    refElement.parentNode.insertBefore(chip, refElement);
    refElement.value = '';
  }

  function makeEventListenerFactory(element) {
    const handlers = []
    function addEventListener(event, eventHandler) {
      const handler = element.addEventListener(event, eventHandler)
      handlers.push({ event: event, handler: handler })
    }
    return { handlers: handlers, addEventListener: addEventListener }
  }

  function setEventListeners(inputContainerNode, options) {
    const factory = makeEventListenerFactory(inputContainerNode);
    const addEventListener = factory.addEventListener;

    addEventListener('click', function (event) {
      if (event.target.classList.contains('emails-input'))
        event.target.querySelector('input').focus();

      if (event.target.classList.contains('remove')) {
        inputContainerNode.querySelector('.emails-input')
          .removeChild(event.target.parentNode);
      }
    });

    addEventListener('focusout', function (event) {
      addChip(event.target, event.target.value);
    });

    addEventListener('paste', function (event) {
      if (!event.target.matches('input'))
        return;

      event.preventDefault();

      var re_email = /([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)/ig;
      const validateEmail = (email) => {
        return email.match(re_email);
      }

      const textPaste = event.clipboardData.getData('Text');
      if (re_email.test(textPaste)) {
        const chunks = validateEmail(textPaste);
        if (chunks.length > 1) {
          chunks.forEach(function (chunk) { addChip(event.target, chunk); });
          return;
        }

        const chunk = chunks[0];
        if (isValidEmail(chunk)) {
          addChip(event.target, chunk);
          return;
        }

        event.target.value += chunk;
        return;
      }

      event.target.value += textPaste;
    });

    addEventListener('keypress', function (event) {
      if (options.triggerKeyCodes.indexOf(event.keyCode) < 0)
        return;
      event.preventDefault();
      addChip(event.target, event.target.value);
    });

    addEventListener('keydown', function (event) {
      if (event.keyCode === keycode.backspace && !event.target.value) {
        const chips = getChips(inputContainerNode);
        if (!chips.length) return;
        const lastChip = chips[chips.length - 1];
        lastChip.remove();
      }
    });

    return factory.handlers;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

}));
