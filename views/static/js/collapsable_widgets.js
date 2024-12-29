const buttons = document.querySelectorAll('.collapsible-button');

buttons.forEach($button => {
  $button.addEventListener('click', () => {
    const id       = $button.getAttribute('data-id');
    const $content = document.getElementById(id)    ;

    $content.classList.toggle('open');

    const spanishText = $button.getAttribute('data-spanish');

    if ($content.classList.contains('open')) {
      $content.style.maxHeight = $content.scrollHeight + 'px';
      $button.textContent = 'Ocultar ' + spanishText;
    } else {
      $content.style.maxHeight = 0;
      $button.textContent = 'Mostrar ' + spanishText;
    }
  });
});
