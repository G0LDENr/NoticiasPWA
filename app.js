/* L.i.s.a.H.W - Sistema de Noticias (PWA)
   app.js: navegación, Service Worker, notificaciones, característica física
   y 4 contenidos dinámicos (Axel, Omar, Juan, Amanda). */

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let DATOS = { axel: [], omar: [], juan: [], amanda: [] };

/* ---------- Mensajes breves ---------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3000);
}

function requiereConexion(accion = 'esta función') {
  if (navigator.onLine) return true;
  toast(`⚠️ ${accion} requiere conexión a Internet`);
  return false;
}

/* ---------- Navegación (App Shell) ---------- */
const VISTAS = ['inicio', 'axel', 'omar', 'juan', 'amanda'];

function mostrarVista() {
  let id = location.hash.replace('#', '');
  if (!VISTAS.includes(id)) id = 'inicio';
  $$('.vista').forEach((v) => (v.hidden = v.id !== id));
  $$('[data-vista]').forEach((a) => a.classList.toggle('activa', a.dataset.vista === id));
  cerrarMenu();
  window.scrollTo({ top: 0 });
  id === 'omar' ? iniciarAutoCarrusel() : detenerAutoCarrusel();
}

function abrirMenu() { $('#menu').classList.add('abierto'); $('#velo').hidden = false; $('#btnMenu').setAttribute('aria-expanded', 'true'); }
function cerrarMenu() { $('#menu').classList.remove('abierto'); $('#velo').hidden = true; $('#btnMenu').setAttribute('aria-expanded', 'false'); }

$('#btnMenu').addEventListener('click', () => ($('#menu').classList.contains('abierto') ? cerrarMenu() : abrirMenu()));
$('#velo').addEventListener('click', cerrarMenu);
window.addEventListener('hashchange', mostrarVista);
window.matchMedia('(min-width: 900px)').addEventListener('change', cerrarMenu);

/* ---------- Estado de conexión ---------- */
function actualizarRed() {
  const en = navigator.onLine;
  const b = $('#estadoRed');
  b.textContent = en ? 'En línea' : 'Sin conexión';
  b.classList.toggle('offline', !en);
  $('#estadoConexion').textContent = en ? 'En línea' : 'Sin conexión (usando caché)';
}
window.addEventListener('online', actualizarRed);
window.addEventListener('offline', actualizarRed);

/* ---------- Service Worker ---------- */
async function registrarSW() {
  const el = $('#estadoSW');
  if (!('serviceWorker' in navigator)) { el.textContent = 'no soportado'; return; }
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    console.log('[PWA] SW registrado. Scope:', reg.scope);

    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo.addEventListener('statechange', () => {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          toast('🔄 Nueva versión disponible. Recarga para actualizar.');
        }
      });
    });

    await navigator.serviceWorker.ready;
    el.textContent = 'activo ✔ (scope: ' + reg.scope.replace(location.origin, '') + ')';
  } catch (e) {
    console.error('[PWA] Error al registrar el SW', e);
    el.textContent = 'error: ' + e.message;
  }
}

/* ---------- Instalación ---------- */
let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  eventoInstalar = e;
  $('#btnInstalar').hidden = false;
});
$('#btnInstalar').addEventListener('click', async () => {
  if (!eventoInstalar) return;
  eventoInstalar.prompt();
  await eventoInstalar.userChoice;
  eventoInstalar = null;
  $('#btnInstalar').hidden = true;
});

/* ---------- Notificaciones ---------- */
function textoPermiso() {
  if (!('Notification' in window)) return 'no soportadas';
  return { granted: 'permitidas ✔', denied: 'bloqueadas ✖', default: 'sin decidir' }[Notification.permission];
}
function actualizarEstadoNotif() { $('#estadoNotif').textContent = textoPermiso(); }

async function pedirPermisoNotif() {
  if (!('Notification' in window)) { toast('Este navegador no soporta notificaciones'); return; }
  const permiso = await Notification.requestPermission();
  actualizarEstadoNotif();
  if (permiso === 'granted') {
    toast('Notificaciones activadas');
    notificar('¡Notificaciones activadas!', 'Recibirás aviso cuando se publique una noticia nueva.');
  } else {
    toast('Permiso de notificaciones no concedido');
  }
}

async function notificar(titulo, cuerpo, url = './#inicio') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opciones = {
    body: cuerpo,
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'lisahw-noticias',
    vibrate: [120, 60, 120],
    data: { url },
  };
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(titulo, opciones);
  } catch {
    new Notification(titulo, opciones);
  }
  return true;
}

$('#btnNotif').addEventListener('click', pedirPermisoNotif);
$('#btnProbarNotif').addEventListener('click', async () => {
  if (!requiereConexion('Enviar notificación')) return;
  const ok = await notificar('L.i.s.a.H.W', 'Notificación de prueba: ¡la PWA funciona!', './#inicio');
  if (!ok) toast('Primero activa las notificaciones');
});

/* ---------- Carga de datos ---------- */
async function cargarDatos(forzar = false) {
  try {
    const r = await fetch('noticias.json', forzar ? { cache: 'no-cache' } : undefined);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    DATOS = await r.json();
  } catch (e) {
    console.warn('[PWA] No se pudo cargar noticias.json', e);
    toast('No se pudieron cargar las noticias');
  }
}

const tarjeta = (n, extra = '') => `
  <article class="tarjeta">
    <span class="etiqueta">${escapar(n.categoria || 'General')}</span>
    <h4>${escapar(n.titulo)}</h4>
    <p>${escapar(n.resumen)}</p>
    ${n.ubicacion ? `<small>📍 ${escapar(n.ubicacion.lat)}, ${escapar(n.ubicacion.lng)}</small><br>` : ''}
    ${n.foto ? `<img src="${n.foto}" alt="Adjunto" style="max-width:100%;border-radius:8px;margin-top:6px;">` : ''}
    <small>${escapar(n.fecha || '')}</small>${extra}
  </article>`;

/* ===== AXEL ===== */
function pintarAxel() {
  $('#axelLista').innerHTML = DATOS.axel.map((n) => tarjeta(n)).join('');
  $('#axelActualizado').textContent = 'Última actualización: ' + new Date().toLocaleTimeString('es-MX');
}
$('#btnActualizar').addEventListener('click', async () => {
  if (!requiereConexion('Actualizar noticias')) return;
  await cargarDatos(true);
  pintarAxel();
  toast('Contenido de Axel actualizado');
});

/* ===== OMAR ===== */
let carIndice = 0, carTimer = null;
function pintarCarrusel() {
  const lista = DATOS.omar;
  if (!lista.length) return;
  carIndice = (carIndice + lista.length) % lista.length;
  const n = lista[carIndice];
  $('#carruselItem').innerHTML = `
    <span class="etiqueta">${escapar(n.categoria)}</span>
    <h3>${escapar(n.titulo)}</h3>
    <p>${escapar(n.resumen)}</p>
    <small>${escapar(n.fecha)}</small>`;
  $('#carPuntos').innerHTML = lista.map((_, i) => `<button class="punto ${i === carIndice ? 'activo' : ''}" data-i="${i}" aria-label="Noticia ${i + 1}"></button>`).join('');
}
function iniciarAutoCarrusel() { detenerAutoCarrusel(); carTimer = setInterval(() => { carIndice++; pintarCarrusel(); }, 5000); }
function detenerAutoCarrusel() { clearInterval(carTimer); }
$('#carPrev').addEventListener('click', () => { carIndice--; pintarCarrusel(); iniciarAutoCarrusel(); });
$('#carNext').addEventListener('click', () => { carIndice++; pintarCarrusel(); iniciarAutoCarrusel(); });
$('#carPuntos').addEventListener('click', (e) => {
  const p = e.target.closest('.punto');
  if (p) { carIndice = Number(p.dataset.i); pintarCarrusel(); iniciarAutoCarrusel(); }
});

/* ===== JUAN ===== */
let juanCategoria = 'Todas';
function pintarJuan() {
  const cats = ['Todas', ...new Set(DATOS.juan.map((n) => n.categoria))];
  $('#juanFiltros').innerHTML = cats.map((c) => `<button class="chip ${c === juanCategoria ? 'activo' : ''}" data-cat="${escapar(c)}">${escapar(c)}</button>`).join('');
  const q = $('#juanBuscar').value.trim().toLowerCase();
  const res = DATOS.juan.filter((n) =>
    (juanCategoria === 'Todas' || n.categoria === juanCategoria) &&
    (n.titulo + ' ' + n.resumen).toLowerCase().includes(q));
  $('#juanLista').innerHTML = res.map((n) => `
    <li><span class="etiqueta">${escapar(n.categoria)}</span>
      <h4>${escapar(n.titulo)}</h4><p>${escapar(n.resumen)}</p><small>${escapar(n.fecha)}</small></li>`).join('');
  $('#juanVacio').hidden = res.length > 0;
}
$('#juanBuscar').addEventListener('input', pintarJuan);
$('#juanFiltros').addEventListener('click', (e) => {
  const c = e.target.closest('.chip');
  if (c) { juanCategoria = c.dataset.cat; pintarJuan(); }
});

/* ===== CARACTERÍSTICA FÍSICA: geolocalización + cámara ===== */
let ubicacionActual = null;
let fotoActual = null;

const btnGeo      = $('#btnGeo');
const geoEstado   = $('#geoEstado');
const btnFoto     = $('#btnFoto');
const inputFoto   = $('#inputFoto');
const fotoPreview = $('#fotoPreview');

btnGeo?.addEventListener('click', () => {
  if (!navigator.geolocation) {
    geoEstado.textContent = 'Geolocalización no soportada';
    $('#estadoGeo').textContent = 'no soportada';
    return;
  }
  if (!navigator.onLine) {
    geoEstado.textContent = 'Sin conexión: la ubicación puede ser imprecisa';
    toast('Sin conexión: se intentará ubicación aproximada');
  }
  geoEstado.textContent = 'Solicitando permiso de ubicación…';
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      ubicacionActual = {
        lat: pos.coords.latitude.toFixed(5),
        lng: pos.coords.longitude.toFixed(5)
      };
      geoEstado.textContent = `📍 ${ubicacionActual.lat}, ${ubicacionActual.lng}`;
      $('#estadoGeo').textContent = 'permiso concedido ✔';
      toast('Ubicación obtenida');
    },
    (err) => {
      const mensajes = {
        1: 'Permiso de ubicación denegado',
        2: 'Ubicación no disponible (revisa tu señal)',
        3: 'Tiempo de espera agotado'
      };
      geoEstado.textContent = 'Error: ' + (mensajes[err.code] || err.message);
      $('#estadoGeo').textContent = 'permiso denegado ✖';
      toast('No se pudo obtener la ubicación');
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
});

btnFoto?.addEventListener('click', () => inputFoto.click());

inputFoto?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('El archivo debe ser una imagen'); return; }
  if (file.size > 2 * 1024 * 1024) { toast('Imagen muy grande (máx. 2 MB)'); return; }
  const reader = new FileReader();
  reader.onload = (ev) => {
    fotoActual = ev.target.result;
    fotoPreview.src = fotoActual;
    fotoPreview.hidden = false;
    $('#estadoCam').textContent = 'captura OK ✔';
    toast('Foto adjuntada');
  };
  reader.readAsDataURL(file);
});

/* ===== AMANDA ===== */
const CLAVE_AMANDA = 'lisahw_amanda';
function leerAmanda() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_AMANDA));
    if (Array.isArray(g)) return g;
  } catch { /* ignorar */ }
  return [...DATOS.amanda];
}
function guardarAmanda(lista) {
  try { localStorage.setItem(CLAVE_AMANDA, JSON.stringify(lista)); } catch { /* ignorar */ }
}
let listaAmanda = [];
function pintarAmanda() {
  $('#amandaLista').innerHTML = listaAmanda.map((n) =>
    tarjeta(n, `<br><button class="btn btn-borrar" data-id="${escapar(n.id)}">Eliminar</button>`)).join('')
    || '<p class="nota">Aún no hay noticias. ¡Publica la primera!</p>';
}

$('#formNoticia').addEventListener('submit', async (e) => {
  e.preventDefault();
  const titulo  = $('#amTitulo').value.trim();
  const resumen = $('#amResumen').value.trim();
  if (!titulo || !resumen) return;

  const nueva = {
    id: 'm' + Date.now(),
    titulo,
    resumen,
    categoria: 'Cultura',
    fecha: new Date().toISOString().slice(0, 10),
    ubicacion: ubicacionActual,
    foto: fotoActual
  };

  listaAmanda = [nueva, ...listaAmanda];
  guardarAmanda(listaAmanda);
  pintarAmanda();

  e.target.reset();
  ubicacionActual = null;
  fotoActual = null;
  if (geoEstado)   geoEstado.textContent = 'Sin ubicación';
  if (fotoPreview) { fotoPreview.hidden = true; fotoPreview.src = ''; }

  toast('Noticia publicada');
  await notificar('Nueva noticia de Amanda', titulo, './#amanda');
});

$('#amandaLista').addEventListener('click', (e) => {
  const b = e.target.closest('.btn-borrar');
  if (!b) return;
  listaAmanda = listaAmanda.filter((n) => n.id !== b.dataset.id);
  guardarAmanda(listaAmanda);
  pintarAmanda();
});

/* ---------- Arranque ---------- */
async function iniciar() {
  actualizarRed();
  actualizarEstadoNotif();

  $('#estadoGeo').textContent = navigator.geolocation ? 'disponible' : 'no soportada';
  $('#estadoCam').textContent = (navigator.mediaDevices || document.createElement('input').capture !== undefined)
    ? 'disponible' : 'no soportada';

  registrarSW();
  await cargarDatos();
  pintarAxel();
  pintarCarrusel();
  pintarJuan();
  listaAmanda = leerAmanda();
  pintarAmanda();
  mostrarVista();
}
iniciar();