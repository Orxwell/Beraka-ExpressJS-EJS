const npt_quantity = document.getElementById('quantity');
const bttn_minus   = document.getElementById('minus')   ;
const bttn_plus    = document.getElementById('plus')    ;

bttn_minus.addEventListener('click', e => {
  let quantity = parseInt(npt_quantity.value) - 1;

  npt_quantity.value = quantity > 0 ? quantity : 0;
});

bttn_plus.addEventListener('click', e => {
  let quantity = parseInt(npt_quantity.value) + 1;

  npt_quantity.value = quantity < 100 ? quantity : 99;
});
