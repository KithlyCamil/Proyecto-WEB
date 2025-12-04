// Toggle del menu
const btnMenu = document.getElementById("btnMenu");
const listaMenu = document.getElementById("listaMenu");
if (btnMenu && listaMenu) {
  btnMenu.addEventListener("click", () => listaMenu.classList.toggle("show"));
}

// Feed BBC y proxy
const FEED = "http://feeds.bbci.co.uk/mundo/rss.xml";
const PROXY = "https://api.allorigins.win/raw?url=" + encodeURIComponent(FEED);

// Contenedores
const cont = document.getElementById("contenedor-noticias");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const spanPagina = document.getElementById("paginaActual");

// Configuración
const ITEMS_PER_PAGE = 5;              // noticias por página (en la lista)
const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutos
let noticias = [];
let paginaActual = 1;

// Utilidad: limpiar HTML en descripciones del feed
const stripHtml = s => (s || "").replace(/<[^>]*>/g, "").trim();

// Obtiene imagen desde diferentes posibles campos del RSS
function getImageFromItem(it) {
  const d = it.querySelector("description")?.textContent || "";
  const node =
    it.querySelector("media\\:thumbnail") ||
    it.querySelector("enclosure") ||
    it.querySelector("thumbnail");
  const fromNode = node?.getAttribute("url");
  if (fromNode) return fromNode;

  const match = d.match(/<img[^>]+src="([^"]+)"/i);
  return match?.[1] || "";
}

// Render principal: destacada, secundarias y lista paginada
function renderPagina() {
  if (!cont) return;

  let html = "";

  // 1) Noticia destacada (solo en página 1 si existe)
  const first = noticias[0];
  if (first && paginaActual === 1) {
    const t = first.querySelector("title")?.textContent || "";
    const d = first.querySelector("description")?.textContent || "";
    const l = first.querySelector("link")?.textContent || "#";
    const img = getImageFromItem(first);

    html += `
      <article class="destacadaCard">
        <a href="${l}" style="color:inherit;text-decoration:none">
          ${img ? `<div class="destacadaImg" style="background-image:url('${img}')"></div>` : ""}
          <div class="destacadaContenido">
            <h2>${t}</h2>
            <p>${stripHtml(d)}</p>
          </div>
        </a>
      </article>
    `;
  }

  // 2) Mini-cards secundarias (items 2–4) solo en página 1
  if (paginaActual === 1) {
    html += `<div class="gridSecundarias">`;
    noticias.slice(1, 4).forEach(it => {
      const t = it.querySelector("title")?.textContent || "";
      const l = it.querySelector("link")?.textContent || "#";
      const img = getImageFromItem(it);
      html += `
        <article class="cardMini">
          <a href="${l}" style="color:inherit;text-decoration:none">
            <div class="miniImg" style="background-image:url('${img || 'https://placehold.co/400x200?text=Sin+imagen'}')"></div>
            <div class="miniBody"><h3>${t}</h3></div>
          </a>
        </article>
      `;
    });
    html += `</div>`;
  }

  // 3) Lista de noticias (centrada en paginas > 1)
  html += `<div class="listaNoticias ${paginaActual > 1 ? "centrada" : ""}">`;

  const base = noticias.slice(4); // resto de noticias
  const totalItems = base.length;

  // si es pagina 1, solo 3 noticias en la lista, si no usa ITEMS_PER_PAGE
  const itemsPorPagina = paginaActual === 1 ? 3 : ITEMS_PER_PAGE;

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPorPagina));
  paginaActual = Math.min(Math.max(1, paginaActual), totalPages);

  const inicio = (paginaActual - 1) * itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  const paginaNoticias = base.slice(inicio, fin);

  paginaNoticias.forEach(it => {
    const t = it.querySelector("title")?.textContent || "";
    const l = it.querySelector("link")?.textContent || "#";
    const d = it.querySelector("description")?.textContent || "";
    const img = getImageFromItem(it);

    html += `
      <article class="cardNoticia">
        <a href="${l}" style="color:inherit;text-decoration:none">
          <div class="imgNoticia" style="background-image:url('${img || 'https://placehold.co/200x100?text=Sin+imagen'}')"></div>
          <div class="noticiaContenido">
            <h4>${t}</h4>
            <p>${stripHtml(d)}</p>
          </div>
        </a>
      </article>
    `;
  });

  html += `</div>`; // cierre listaNoticias

  // Inyectar en DOM
  cont.innerHTML = html;

  // Actualizar paginador
  actualizarPaginador(totalPages);

  // Mostrar/ocultar aside según página
  const aside = document.querySelector(".columnaDerecha");
  if (aside) {
    if (paginaActual === 1) {
      aside.style.display = ""; // visible normal
      actualizarTarjetaVivo();  // actualiza tarjeta vivo
    } else {
      aside.style.display = "none"; // ocultar en otras paginas
    }
  }
}

// Actualiza botones y texto del paginador
function actualizarPaginador(totalPages) {
  if (btnPrev && btnNext && spanPagina) {
    btnPrev.disabled = paginaActual <= 1;
    btnNext.disabled = paginaActual >= totalPages;
    spanPagina.textContent = `Página ${paginaActual} de ${totalPages}`;
  }
}

// Botones de paginación
if (btnPrev) {
  btnPrev.addEventListener("click", () => {
    paginaActual = Math.max(1, paginaActual - 1);
    renderPagina();
    scrollALista();
  });
}
if (btnNext) {
  btnNext.addEventListener("click", () => {
    paginaActual = paginaActual + 1;
    renderPagina();
    scrollALista();
  });
}

// Scroll suave hacia la lista tras cambiar de página
function scrollALista() {
  const lista = document.querySelector(".listaNoticias");
  if (lista) {
    lista.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// Actualiza la tarjeta "Actualizaciones en Vivo" del aside
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

// Descarga del feed y render
async function fetchAndRender() {
  try {
    const res = await fetch(PROXY);
    if (!res.ok) throw new Error("Error al obtener feed");
    const xmlText = await res.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");
    noticias = Array.from(xml.querySelectorAll("item"));
    paginaActual = 1; // reset a la primera página con nuevos datos
    renderPagina();
  } catch (e) {
    console.error("Error cargando feed:", e);
  }
}

// Inicialización y actualización programada
fetchAndRender();
setInterval(fetchAndRender, UPDATE_INTERVAL);
