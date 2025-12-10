const btnMenu = document.getElementById("btnMenu");
const listaMenu = document.getElementById("listaMenu");
if (btnMenu && listaMenu) { 
  btnMenu.addEventListener("click", () => listaMenu.classList.toggle("show"));
}

const btnSuscribir = document.getElementById("btnSuscribir"); 
const emailInput = document.getElementById("emailNews");
if (btnSuscribir && emailInput) {
  btnSuscribir.addEventListener("click", () => {
    const email = emailInput.value.trim(); 
    if (!email) {
      alert("Por favor ingresa tu correo electrónico."); 
      return;
    }
    alert(`¡Gracias por suscribirte, ${email}! Te avisamos de las noticias más importantes.`);
    emailInput.value = "";
  });
}

//feed y proxies
const FEED = "https://feeds.bbci.co.uk/mundo/rss.xml"; // URL del feed RSS de BBC Mundo
const PROXY_MAIN = "https://api.allorigins.win/get?url=" + encodeURIComponent(FEED); //para evitar CORS (devuelve json con el xml dentro)
const PROXY_ALT  = "https://r.jina.ai/http://feeds.bbci.co.uk/mundo/rss.xml"; //lee y devuelve el xml como texto directamente (no CORS)

const cont = document.getElementById("contenedor-noticias"); //contenedor principal
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const spanPagina = document.getElementById("paginaActual"); //pagina

const ITEMS_PER_PAGE = 5;
const UPDATE_INTERVAL = 30 * (60 * 1000); //actualiza cada 30 minutos

let noticias = []; //se almacenan las noticias parseadas del RSS
let paginaActual = 1;
let categoriaSeleccionada = "Todas";

//ayudantesxd
const stripHtml = s => (s || "").replace(/<[^>]*>/g, "").trim(); //eliminaremos etiquetas HTML de un string
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); //normaliza texto a minusculas y sin acentos

function clasificarTexto(texto) { //clasifica el texto en una categoria segun palabras clave
  const t = norm(texto || "");
  if (/futbol|deporte|mundial|seleccion|liga|partido|torneo/.test(t)) return "Deportes";
  if (/economia|finanzas|mercado|dinero|remesas|precio|petroleo|inflacion|divisa/.test(t)) return "Economía";
  if (/tecnolog|internet|ia|ciencia|innovacion|robot|software|ciberseguridad|big\s?data/.test(t)) return "Tecnología";
  if (/cultura|arte|musica|cine|literatura|arquitecto|guggenheim|eurovision|teatro|fotografo/.test(t)) return "Cultura";
  if (/trump|biden|maduro|putin|guerra|conflicto|politica|eleccion|presidente|venezuela|ucrania|mexico|españa|honduras|chile|peru|embargo|sancion|boicot/.test(t)) return "Internacional";
  return "General";
}

function getImageFromItem(it) { //intenta obtener una imagen del item RSS
  const d = it.querySelector("description")?.textContent || ""; //toma la descripcion, que a veces incluye un <img>
  const node = it.querySelector("media\\:thumbnail") || it.querySelector("enclosure") || it.querySelector("thumbnail"); //nodos con url img
  const fromNode = node?.getAttribute("url"); //extrar url
  if (fromNode) return fromNode;
  const match = d.match(/<img[^>]+src="([^"]+)"/i); //intenta buscar un <img>
  return match?.[1] || "";
}

function getItemId(it) { //generamos id unico xd
  const guid = it.querySelector("guid")?.textContent?.trim();
  const link = it.querySelector("link")?.textContent?.trim();
  const title = it.querySelector("title")?.textContent?.trim();
  return guid || link || title || Math.random().toString(36).slice(2); //di nada está disponible, crea un id aleatorio
}

function filtrarNoticiasPorCategoria(categoria) { //devuelve noticias según la categoría seleccionada
  if (categoria === "Todas") return noticias.slice();
  return noticias.filter(n => n.categoria === categoria); //sino, filtramos por coincidencia exacta de categoría
}

function setAsideVisibility() { //aseguramos que el aside se muestre y actualice su contenido
  const aside = document.querySelector(".columnaDerecha");
  if (!aside) return;
  aside.style.display = "";
  actualizarTarjetaVivo();
}

// Modal
function ensureModal() { 
  if (document.getElementById("modalNoticia")) return; //si ya hay un modal, no lo vuelve a crear
  const modal = document.createElement("div"); //crea el contenedor del modal
  modal.id = "modalNoticia"; //asigna id
  modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;"; //estilos básicos del overlay
  modal.innerHTML = `
    <div id="modalContenido" style="background:#fff;max-width:900px;margin:5% auto;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.3)">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-bottom:1px solid #eee">
        <h2 id="modalTitulo" style="margin:0;font-size:22px;line-height:1.3"></h2>
        <button id="cerrarModal" style="border:none;background:transparent;font-size:24px;cursor:pointer;line-height:1" aria-label="Cerrar modal">×</button>
      </div>
      <div id="modalImagen" style="width:100%;padding-top:42%;background:#f5f5f5;background-size:cover;background-position:center center"></div>
      <div id="modalDescripcion" style="padding:16px 20px;font-size:16px;line-height:1.6;color:#333"></div>
      <div style="padding:12px 20px;border-top:1px solid #eee;display:flex;gap:12px;align-items:center;justify-content:flex-end">
        <a id="modalIrFuente" href="#" target="_blank" rel="noopener" style="padding:10px 14px;border-radius:8px;background:#0a66c2;color:#fff;text-decoration:none;font-weight:600">Ver fuente</a>
        <button id="modalCerrarBtn" style="padding:10px 14px;border-radius:8px;border:1px solid #888;background:#fff;cursor:pointer">Cerrar</button>
      </div>
    </div>`;
  document.body.appendChild(modal); //insertamos el modal en el body
  document.getElementById("cerrarModal").addEventListener("click", cerrarModal); // x
  document.getElementById("modalCerrarBtn").addEventListener("click", cerrarModal); // cerrar
  modal.addEventListener("click", (e) => { if (e.target.id === "modalNoticia") cerrarModal(); }); //afuera
}

function abrirModalNoticiaByIndex(idx) { //abre el modal (idx)
  ensureModal();//existe
  const n = noticias[idx]; //obetenemos not
  if (!n) return;
  document.getElementById("modalTitulo").textContent = n.titulo || "Sin título";
  document.getElementById("modalDescripcion").textContent = stripHtml(n.descripcion || "");
  const imgDiv = document.getElementById("modalImagen"); //div que muestra la imagen
  imgDiv.style.backgroundImage = `url('${n.imagen || "https://placehold.co/800x400?text=Sin+imagen"}')`;
  const fuente = document.getElementById("modalIrFuente"); //enlace
  fuente.href = n.link || "#";
  document.getElementById("modalNoticia").style.display = "block"; //mueestra el modal
}

function cerrarModal() { //cierra modal 
  const modal = document.getElementById("modalNoticia");
  if (modal) modal.style.display = "none";
}

function renderPagina() { //segun la cat y la pag
  if (!cont) return; //si no hay contenedor, no pasa nada xdXdxDXD

  const filtradas = filtrarNoticiasPorCategoria(categoriaSeleccionada); //filtro

  //si no hay not en la cat
  if (filtradas.length === 0) { //si el vec esta vacoi
    let lista = cont.querySelector(".listaNoticias"); //busca la lista existente
    if (!lista) {
      lista = document.createElement("div"); // Crea una nueva, asignamos clase y agregamos
      lista.className = "listaNoticias";
      cont.appendChild(lista);
    }
    lista.innerHTML = `<p>No hay noticias en la categoría <strong>${categoriaSeleccionada}</strong>.</p>`; // Mensaje vacio
    actualizarPaginador(1);
    setAsideVisibility();
    return; //termina aqi
  }

  //destacada y secundarias
  if (!cont.querySelector(".destacadaCard")) { //no dibujo
    const it = filtradas[0]; // toma la primera noticia como destacada
    const idxDest = noticias.findIndex(n => n.id === it.id); //buscamos indice
    const destacadaHtml = `
      <article class="destacadaCard" data-index="${idxDest}">
        ${it.imagen ? `<div class="destacadaImg" style="background-image:url('${it.imagen}')"></div>` : ""}
        <div class="destacadaContenido">
          <h2>${it.titulo}</h2>
          <p>${stripHtml(it.descripcion)}</p>
        </div>
      </article>`;
    cont.insertAdjacentHTML("afterbegin", destacadaHtml); //Lo ponemos al innicio dedl cont

    //secundarias 
    let secundariasHtml = `<div class="gridSecundarias">`;
    const secundarias = filtradas.slice(1, 4); //toma hasta 3 noticias
    for (let i = 0; i < 3; i++) { //siempre 3
      const it2 = secundarias[i];
      if (it2) { //si hay noticia
        const idx2 = noticias.findIndex(n => n.id === it2.id); //indice global
        secundariasHtml += `
          <article class="cardMini" data-index="${idx2}">
            <div class="miniImg" style="background-image:url('${it2.imagen || 'https://placehold.co/400x200?text=Sin+imagen'}')"></div>
            <div class="miniBody"><h3>${it2.titulo}</h3></div>
          </article>`;
      } else {
        secundariasHtml += `
          <article class="cardMini placeholder">
            <div class="miniImg" style="background:#eee;display:flex;align-items:center;justify-content:center;height:100%">
              <span>No hay noticias disponibles :(</span>
            </div>
          </article>`;
      }
    }
    secundariasHtml += `</div>`;
    cont.insertAdjacentHTML("beforeend", secundariasHtml); //lo agregamos al final del cont
  }

  // Lista principal
  let lista = cont.querySelector(".listaNoticias"); //buscamos la lista principal
  if (!lista) {
    lista = document.createElement("div");
    lista.className = "listaNoticias";
    cont.appendChild(lista); //agregamos al cont
  }

  const base = filtradas.slice(4); //primeros 4
  const totalItems = base.length; // Total de items para lista
  const itemsPorPagina = ITEMS_PER_PAGE; //cantidad fija por pagina (osea 4xd)

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPorPagina)); //calculamos paginas totales
  paginaActual = Math.min(Math.max(1, paginaActual), totalPages); //corregimos pag actual si se pasa

  const inicio = (paginaActual - 1) * itemsPorPagina; 
  const fin = inicio + itemsPorPagina;
  const paginaNoticias = base.slice(inicio, fin); // Noticias que se muestran en esta pag

  let listaHtml = ""; // Acumulamos el html de las cards
  for (let i = 0; i < itemsPorPagina; i++) { //hasta completar ITEMS_PER_PAGE
    const it = paginaNoticias[i]; //toma si existe
    if (it) {
      const idx = noticias.findIndex(n => n.id === it.id); //indice pal mdoal
      listaHtml += `
        <article class="cardNoticia" data-index="${idx}">
          <div class="imgNoticia" style="background-image:url('${it.imagen || 'https://placehold.co/200x100?text=Sin+imagen'}')"></div>
          <div class="noticiaContenido">
            <h4>${it.titulo}</h4>
            <p>${stripHtml(it.descripcion)}</p>
          </div>
        </article>`;
    } else {//si falta
      listaHtml += `
        <article class="cardNoticia placeholder">
          <div class="imgNoticia" style="background:#eee;display:flex;align-items:center;justify-content:center;height:100px">
            <span>No hay noticias</span>
          </div>
          <div class="noticiaContenido">
            <h4></h4>
            <p></p>
          </div>
        </article>`;
    }
  }

  lista.innerHTML = listaHtml; //inyectamos el HTML construido dentro de la lista

  actualizarPaginador(totalPages); //actualiza estado de los botones y del paginador
  setAsideVisibility();
}

//cualquier elemento con dataindex dentro del cont abre el modal
if (cont) {
  cont.addEventListener("click", (e) => {
    const card = e.target.closest("[data-index]"); //busca el contenedor clickeado
    if (!card) return;
    const idx = Number(card.getAttribute("data-index"));
    if (Number.isFinite(idx)) abrirModalNoticiaByIndex(idx); //abre modal si el índice es válido
  });
}

function actualizarPaginador(totalPages) {
  if (btnPrev && btnNext && spanPagina) { //existen elementos
    btnPrev.disabled = paginaActual <= 1; //deshabilita
    btnNext.disabled = paginaActual >= totalPages; //deshabilita
    spanPagina.textContent = `Página ${paginaActual} de ${totalPages}`; //actualiza texto
  }
}

// Navegacion
if (btnPrev) { // Si existe ant
  btnPrev.addEventListener("click", () => {
    paginaActual = Math.max(1, paginaActual - 1); //decrementa pagina
    renderPagina(); //vuelve a renderizar
    scrollALista(); //desplaza la vista hacia la lista
    setAsideVisibility();
  });
}
if (btnNext) { // Si existe sig
  btnNext.addEventListener("click", () => { 
    paginaActual = paginaActual + 1; //Incrementa pag
    renderPagina();
    scrollALista();
    setAsideVisibility();
  });
}

function scrollALista() { //scroll suave hasta el inicio de la lista
  const lista = document.querySelector(".listaNoticias"); //selecciona la lista
  if (lista) {
    lista.scrollIntoView({ behavior: "smooth", block: "start" }); //scroll suave
  }
}

//Actualizaciones en Vivo
function actualizarTarjetaVivo() {
  const aside = document.querySelector(".columnaDerecha"); 
  if (!aside) return;
  const existente = aside.querySelector(".tarjetaVivo");
  if (existente) {
    const p = existente.querySelector("#textoActualizacion");
    const span = existente.querySelector("#horaActualizacion");
    if (p) p.textContent = "Última comprobación:";
    if (span) span.textContent = new Date().toLocaleTimeString(); //hora local actual
  } else { //cremos si no hay
    const timeHtml = `
      <div class="tarjetaVivo">
        <h3>Actualizaciones en Vivo</h3>
        <p id="textoActualizacion">Última comprobación:</p>
        <span id="horaActualizacion">${new Date().toLocaleTimeString()}</span>
      </div>`;
    aside.insertAdjacentHTML("afterbegin", timeHtml); //insertamos al inicio del aside
  }
}

// Categorías
document.querySelectorAll(".listaMenu a, .tema").forEach(btn => { //enlaces de menu
  btn.addEventListener("click", e => {
    e.preventDefault();
    const texto = btn.textContent.replace("#", "").trim(); //obtiene el texto y limpia si no hay
    const lower = texto.toLowerCase(); //lo pasamos a minusculas

    categoriaSeleccionada = (lower === "inicio" || lower === "general") ? "Todas" : texto;
    paginaActual = 1;//reiniciamos pag

    cont.querySelectorAll(".destacadaCard, .gridSecundarias").forEach(el => el.remove()); // Remueve la portada anterior y todo lo demas
    const lista = cont.querySelector(".listaNoticias");
    if (lista) lista.innerHTML = ""; //limpia la lista

    renderPagina(); //renderiza la nueva categoría
    scrollALista();
    setAsideVisibility();
  });
});

// Fetch con reintentos y fallback
async function fetchFeedWithFallback(maxTries = 2) { // Descarga el feed con intento principal y fallback
  // Intento 1: AllOrigins (JSON -> contents)
  for (let i = 0; i < maxTries; i++) { // Intenta varias veces el proxy principal
    try {
      const res = await fetch(PROXY_MAIN, { cache: "no-store" }); // Evita cache del navegador
      if (!res.ok) throw new Error("AllOrigins no ok"); // Si la respuesta no es OK, lanza error
      const data = await res.json(); // AllOrigins devuelve JSON
      const xmlText = data?.contents; // El XML viene en la propiedad contents
      if (!xmlText || typeof xmlText !== "string") throw new Error("Contenido vacío"); // Valida que haya texto
      return xmlText; // Devuelve el XML como string
    } catch (err) {
      // intenta de nuevo // Silencia el error y reintenta
    }
  }
  // Fallback: Jina Reader (devuelve el XML como texto plano, sin CORS)
  const altRes = await fetch(PROXY_ALT, { cache: "no-store" }); // Intenta el lector alternativo
  if (!altRes.ok) throw new Error("Fallback no ok"); // Si falla, lanza error
  const altText = await altRes.text(); // Obtiene texto plano del XML
  if (!altText || !altText.includes("<rss")) throw new Error("Fallback no devolvió XML"); // Valida que realmente sea un RSS
  return altText; // Devuelve el XML plano
}

async function fetchAndRender() { //descargamos el feed, lo parseamos y renderiza la pagina
  try {
    let lista = cont.querySelector(".listaNoticias"); //busca la lista existente
    if (!lista) {
      lista = document.createElement("div");
      lista.className = "listaNoticias";
      cont.appendChild(lista); //agregamos al cont
    }
    lista.innerHTML = `<p>Cargando noticias...</p>`; //pequeño loader

    const xmlText = await fetchFeedWithFallback(2); //obtiene el XML usando proxy con fallback

    const parser = new DOMParser(); //crea un parser para convertir string XML a documento
    const xml = parser.parseFromString(xmlText, "application/xml"); //parsea el XML
    const parseError = xml.querySelector("parsererror"); //verifica si hubo errores de parseo
    if (parseError) throw new Error("Error parseando XML"); //si hay error de parseo, corta

    const items = Array.from(xml.querySelectorAll("item")); //obtiene todos los <item> del RSS
    const vistos = new Set(); //para evitar duplicados por el id
    noticias = []; //resetea el array global de noticias

    for (const it of items) {
      const id = getItemId(it); // Generaramo u obtenemos un id unico
      if (vistos.has(id)) continue; 
      vistos.add(id);

      const titulo = it.querySelector("title")?.textContent?.trim() || ""; //extrae titulo
      const descripcion = it.querySelector("description")?.textContent?.trim() || ""; //extrae descripcion
      const link = it.querySelector("link")?.textContent?.trim() || ""; //extrae enlace a la noticia
      const imagen = getImageFromItem(it); //extrae URL de imagen
      const categoria = clasificarTexto(`${titulo} ${descripcion}`); //clasifica por palabras clave en titulo o descr

      noticias.push({ id, titulo, descripcion, link, imagen, categoria });
    }

    categoriaSeleccionada = "Todas";
    paginaActual = 1;

    //Limpia portada
    cont.querySelectorAll(".destacadaCard, .gridSecundarias").forEach(el => el.remove()); //eliminamos portada anterior
    if (lista) lista.innerHTML = "";

    renderPagina(); //renderiza con nyuvos datos
    setAsideVisibility();
  } catch (e) {
    console.error("Error cargando feed:", e); // Loguea el error en consola para depuración
    let lista = cont.querySelector(".listaNoticias");
    if (!lista) {
      lista = document.createElement("div");
      lista.className = "listaNoticias";
      cont.appendChild(lista);
    }
    lista.innerHTML = `<p>No pudimos cargar el feed en este momento. Intenta nuevamente.</p>`; //mensaje de error 
    const aside = document.querySelector(".columnaDerecha");
    if (aside) aside.style.display = "";
  }
}

fetchAndRender(); // Lanza la primera carga del feed
setInterval(fetchAndRender, UPDATE_INTERVAL); //actualizaciones automaticas
