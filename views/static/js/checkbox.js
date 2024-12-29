const $password = document.getElementById('password');
const $checkbox = document.getElementById('checkbox');

$checkbox.addEventListener("click", () => {
  const flag = $password.type;
  
  if ( flag === 'password') { $password.type = 'text'    ; }
  else                      { $password.type = 'password'; }
});
