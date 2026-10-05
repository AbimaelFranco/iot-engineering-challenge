/*
 * Personalizacion minima del admin de Jazzmin (ver JAZZMIN_SETTINGS en
 * config/settings.py, custom_js). Jazzmin ya trae un "Cerrar sesion"
 * funcional, pero escondido dentro del dropdown del usuario (arriba a la
 * derecha) - facil de pasar por alto. Esto agrega un boton visible en la
 * barra superior que simplemente envia el formulario de logout real que
 * jazzmin ya genera en el DOM (id="logout-form", con su propio CSRF
 * token), en vez de duplicar la logica de cierre de sesion.
 */
document.addEventListener('DOMContentLoaded', function () {
    var logoutForm = document.getElementById('logout-form');
    var navRight = document.querySelector('#jazzy-navbar .navbar-nav.ms-auto');
    if (!logoutForm || !navRight) {
        return;
    }

    var li = document.createElement('li');
    li.className = 'nav-item';

    var btn = document.createElement('button');
    btn.type = 'submit';
    btn.setAttribute('form', logoutForm.id);
    btn.className = 'nav-link btn';
    btn.title = 'Cerrar sesion';
    btn.innerHTML = '<i class="fas fa-sign-out-alt" aria-hidden="true"></i>' +
        '<span class="d-none d-sm-inline ms-1">Cerrar sesion</span>';

    li.appendChild(btn);
    navRight.insertBefore(li, navRight.firstChild);
});
