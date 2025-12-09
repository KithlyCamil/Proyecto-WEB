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

//direccion del feed rss y proxy para evitar problemas de cors al leerlo desde el navegador
const FEED = "https://feeds.bbci.co.uk/mundo/rss.xml";
const PROXY = "https://api.allorigins.win/get?url=" + encodeURIComponent(FEED);

const cont = document.getElementById("contenedor-noticias");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const spanPagina = document.getElementById("paginaActual");

const ITEMS_PER_PAGE = 5; //paginas
const UPDATE_INTERVAL = 30 * (60 * 1000); // actualizacion
let noticias = []; //objetos noticiaxd
let paginaActual = 1; // pagina actual
let categoriaSeleccionada = "Todas"; // Inicio

// para limpiar o normalizar texto
const stripHtml = s => (s || "").replace(/<[^>]*>/g, "").trim(); // quita etiquetas HTML
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim(); // minusculas y sin acentos

//el RSS a veces no trae <category>
function clasificarTexto(texto) {
  const t = norm(texto || "");
  if (/futbol|deporte|mundial|seleccion|liga|partido|torneo/.test(t)) return "Deportes";
  if (/economia|finanzas|mercado|dinero|remesas|precio|petroleo|inflacion|divisa/.test(t)) return "Economía";
  if (/tecnolog|internet|ia|ciencia|innovacion|robot|software|ciberseguridad|big\s?data/.test(t)) return "Tecnología";
  if (/cultura|arte|musica|cine|literatura|arquitecto|guggenheim|eurovision|teatro|fotografo/.test(t)) return "Cultura";
  if (/trump|biden|maduro|putin|guerra|conflicto|politica|eleccion|presidente|venezuela|ucrania|mexico|españa|honduras|chile|peru|embargo|sancion|boicot/.test(t)) return "Internacional";
  return "General";
}

//intentamos obtener la imagen del item RSS
function getImageFromItem(it) {
  const d = it.querySelector("description")?.textContent || "";
  const node = it.querySelector("media\\:thumbnail") || it.querySelector("enclosure") || it.querySelector("thumbnail");
  const fromNode = node?.getAttribute("url");
  if (fromNode) return fromNode;
  const match = d.match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] || "";
}

//generamos un ID unico por noticia
function getItemId(it) {
  const guid = it.querySelector("guid")?.textContent?.trim();
  const link = it.querySelector("link")?.textContent?.trim();
  const title = it.querySelector("title")?.textContent?.trim();
  return guid || link || title || Math.random().toString(36).slice(2);
}

//filtra las noticias por la categoria seleccionada
function filtrarNoticiasPorCategoria(categoria) {
  if (categoria === "Todas") return noticias.slice();
  return noticias.filter(n => n.categoria === categoria);
}

// controlamos el aside (solo se ve en la pagina 1) 
function setAsideVisibility() {
  const aside = document.querySelector(".columnaDerecha");
  if (!aside) return;
  if (paginaActual === 1) {
    aside.style.display = "";
    actualizarTarjetaVivo(); // actualiza la hora
  } else {
    aside.style.display = "none";
  }
}

// creamos el modal
function ensureModal() {
  if (document.getElementById("modalNoticia")) return; // ya existe

  const modal = document.createElement("div");
  modal.id = "modalNoticia";
  modal.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;";
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
    </div>
  `;
  document.body.appendChild(modal);

  //eventos para cerrar el modal
  document.getElementById("cerrarModal").addEventListener("click", cerrarModal);
  document.getElementById("modalCerrarBtn").addEventListener("click", cerrarModal);
  modal.addEventListener("click", (e) => {
    if (e.target.id === "modalNoticia") cerrarModal();
  });
}

//abre el modal con la noticia seleccionada
function abrirModalNoticiaByIndex(idx) {
  ensureModal();
  const n = noticias[idx];
  if (!n) return;

  document.getElementById("modalTitulo").textContent = n.titulo || "Sin título";
  document.getElementById("modalDescripcion").textContent = stripHtml(n.descripcion || "");
  const imgDiv = document.getElementById("modalImagen");
  imgDiv.style.backgroundImage = `url('${n.imagen || "https://placehold.co/800x400?text=Sin+imagen"}')`;
  const fuente = document.getElementById("modalIrFuente");
  fuente.href = n.link || "#";
  document.getElementById("modalNoticia").style.display = "block";
}

//ocultamos o cerramos el modal
function cerrarModal() {
  const modal = document.getElementById("modalNoticia");
  if (modal) modal.style.display = "none";
}

//pagina 1
function renderPagina() {
  if (!cont) return;

  const filtradas = filtrarNoticiasPorCategoria(categoriaSeleccionada);

  //Si no hay noticias en la categoria seleccionada arreglamos
  if (filtradas.length === 0) {
    cont.innerHTML = `
      <div class="listaNoticias ${paginaActual > 1 ? "centrada" : ""}">
        <p>No hay noticias en la categoría <strong>${categoriaSeleccionada}</strong>.</p>
      </div>`;
    actualizarPaginador(1);
    setAsideVisibility();
    return;
  }

  let html = "";

  // Noticia destacada
  if (paginaActual === 1 && filtradas[0]) {
    const it = filtradas[0];
    const idx = noticias.findIndex(n => n.id === it.id);
    html += `
      <article class="destacadaCard" data-index="${idx}">
        ${it.imagen ? `<div class="destacadaImg" style="background-image:url('${it.imagen}')"></div>` : ""}
        <div class="destacadaContenido">
          <h2>${it.titulo}</h2>
          <p>${stripHtml(it.descripcion)}</p>
        </div>
      </article>`;
  }

  //Noticias secundarias
  if (paginaActual === 1) {
    html += `<div class="gridSecundarias">`;
    filtradas.slice(1, 4).forEach(it => {
      const idx = noticias.findIndex(n => n.id === it.id);
      html += `
        <article class="cardMini" data-index="${idx}">
          <div class="miniImg" style="background-image:url('${it.imagen || 'https://placehold.co/400x200?text=Sin+imagen'}')"></div>
          <div class="miniBody"><h3>${it.titulo}</h3></div>
        </article>`;
    });
    html += `</div>`;
  }

  //lista principal de noticias
  html += `<div class="listaNoticias ${paginaActual > 1 ? "centrada" : ""}">`;

  //Base para la lista, excluimos destacada y secundarias 
  const base = filtradas.slice(4);
  const totalItems = base.length;

  //En página 1 mostramos 4 noticias en la lista
  const itemsPorPagina = paginaActual === 1 ? 4 : ITEMS_PER_PAGE;

  //calculos de paginacion
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
  paginaActual = Math.min(Math.max(1, paginaActual), totalPages);

  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const paginaNoticias = base.slice(inicio, fin);

  //si no hay items decimos
  if (paginaNoticias.length === 0) {
    html += `<p>No hay más noticias para mostrar en esta categoría.</p>`;
  }

  //pintamos las cards de la lista (cada una abre el modal al hacer click)
  paginaNoticias.forEach(it => {
    const idx = noticias.findIndex(n => n.id === it.id);
    html += `
      <article class="cardNoticia" data-index="${idx}">
        <div class="imgNoticia" style="background-image:url('${it.imagen || 'https://placehold.co/200x100?text=Sin+imagen'}')"></div>
        <div class="noticiaContenido">
          <h4>${it.titulo}</h4>
          <p>${stripHtml(it.descripcion)}</p>
        </div>
      </article>`;
  });

  html += `</div>`; // cierre de listaNoticias

  //Inyectamos todo el HTML en el contenedor
  cont.innerHTML = html;

  //Conecta los clics de cada card a la apertura del modal
  cont.querySelectorAll("[data-index]").forEach(card => {
    card.addEventListener("click", () => {
      const idx = Number(card.getAttribute("data-index"));
      abrirModalNoticiaByIndex(idx);
    });
  });

  //actualizamos el paginador y el aside segun la página actual
  actualizarPaginador(totalPages);
  setAsideVisibility();
}

//actualizamos los botones de paginación
function actualizarPaginador(totalPages) {
  if (btnPrev && btnNext && spanPagina) {
    btnPrev.disabled = paginaActual <= 1;
    btnNext.disabled = paginaActual >= totalPages;
    spanPagina.textContent = `Página ${paginaActual} de ${totalPages}`;
  }
}

//manejo de los botones "Anterior" y "Siguiente"
if (btnPrev) {
  btnPrev.addEventListener("click", () => {
    paginaActual = Math.max(1, paginaActual - 1);
    renderPagina();
    scrollALista(); //que el usuario vea la lista al cambiar
    setAsideVisibility();
  });
}
if (btnNext) {
  btnNext.addEventListener("click", () => {
    paginaActual = paginaActual + 1;
    renderPagina();
    scrollALista();
    setAsideVisibility();
  });
}

//hace scroll suave hasta el inicio de la lista
function scrollALista() {
  const lista = document.querySelector(".listaNoticias");
  if (lista) {
    lista.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

//actualiza el bloque "Actualizaciones en Vivo" con la hora de la ultima comprobacion
function actualizarTarjetaVivo() {
  const aside = document.querySelector(".columnaDerecha");
  if (!aside) return;
  const existente = aside.querySelector(".tarjetaVivo");
  if (existente) {
    const p = existente.querySelector("#textoActualizacion");
    const span = existente.querySelector("#horaActualizacion");
    if (p) p.textContent = "Última comprobación:";
    if (span) span.textContent = new Date().toLocaleTimeString();
  } else {
    const timeHtml = `
      <div class="tarjetaVivo">
        <h3>Actualizaciones en Vivo</h3>
        <p id="textoActualizacion">Última comprobación:</p>
        <span id="horaActualizacion">${new Date().toLocaleTimeString()}</span>
      </div>`;
    aside.insertAdjacentHTML("afterbegin", timeHtml);
  }
}

//CATEGORIAS
//Al hacer click cambiamos la categorIa, volvemos a la pagina 1 y renderizamos
document.querySelectorAll(".listaMenu a, .tema").forEach(btn => {
  btn.addEventListener("click", e => {
    e.preventDefault();
    const texto = btn.textContent.replace("#", "").trim();
    const lower = texto.toLowerCase();

    categoriaSeleccionada = (lower === "inicio" || lower === "general") ? "Todas" : texto;

    paginaActual = 1;
    renderPagina();
    scrollALista();
    setAsideVisibility();
  });
});

//descarga el RSS, parsea el XML y construye el array `noticias` con datos
async function fetchAndRender() {
  try {
    const res = await fetch(PROXY);
    if (!res.ok) throw new Error("Error al obtener feed");
    const data = await res.json();       // /get devuelve JSON con { contents }
    const xmlText = data.contents;

    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    const items = Array.from(xml.querySelectorAll("item"));
    const vistos = new Set();
    noticias = [];

    for (const it of items) {
      const id = getItemId(it);
      if (vistos.has(id)) continue; // evita duplicados si el feed repite
      vistos.add(id);

      const titulo = it.querySelector("title")?.textContent?.trim() || "";
      const descripcion = it.querySelector("description")?.textContent?.trim() || "";
      const link = it.querySelector("link")?.textContent?.trim() || "";
      const imagen = getImageFromItem(it);
      const categoria = clasificarTexto(`${titulo} ${descripcion}`);

      noticias.push({ id, titulo, descripcion, link, imagen, categoria });
    }

    //al cargar, mostramos todas las noticias en pagina 1
    categoriaSeleccionada = "Todas";
    paginaActual = 1;
    renderPagina();
    setAsideVisibility();
  } catch (e) {
    console.error("Error cargando feed:", e);
    if (cont) {
      cont.innerHTML = `<p>No pudimos cargar el feed en este momento. Intenta nuevamente.</p>`;
    }
    const aside = document.querySelector(".columnaDerecha");
    if (aside) aside.style.display = "none";
  }
}

//arranque inicial y refresco programado del feed
fetchAndRender();
setInterval(fetchAndRender, UPDATE_INTERVAL);
