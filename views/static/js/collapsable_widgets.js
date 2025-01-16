const buttons = document.querySelectorAll('.collapsible-button');

buttons.forEach($button => {
  $button.addEventListener('click', () => {
    const id       = $button.getAttribute('data-id');
    const $content = document.getElementById(id)    ;

    $content.classList.toggle('open');
    $button.classList.toggle('pressed');

    const spanishText = $button.getAttribute('data-spanish');
    let calHeight = $content.firstElementChild.scrollHeight;

    if ($content.classList.contains('open')) {
      calHeight = `${parseInt(calHeight, 10) + 30}`
      $content.style.maxHeight =  calHeight + 'px';
      $button.textContent = 'Ocultar ' + spanishText;
    } else {
      $content.style.maxHeight = 0;
      $button.textContent = 'Mostrar ' + spanishText;
    }
  });
});
