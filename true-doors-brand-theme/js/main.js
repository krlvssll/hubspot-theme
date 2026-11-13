// True Doors Theme - main JavaScript entry point

(function () {
  var toggle = document.querySelector('[data-td-nav-toggle]');
  var nav = document.querySelector('[data-td-nav]');

  if (!toggle || !nav) {
    return;
  }

  toggle.addEventListener('click', function () {
    var isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
})();
