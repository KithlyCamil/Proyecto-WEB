// Este archivo contiene la lógica básica para el menú y la carga de noticias (sin funcionalidad por ahora).

const btnMenu = document.getElementById("btnMenu");
const listaMenu = document.getElementById("listaMenu");

// Evento para mostrar/ocultar el menú en dispositivos móviles
btnMenu.addEventListener("click", () => {
    listaMenu.classList.toggle("show");
});

// cargar not del bbc
const cajaNoticias = document.querySelector(".principal");

// Feed RSS2JSON de BBC Mundo
const API_URL = "https://api.rss2json.com/v1/api.json?rss_url=" +
                encodeURIComponent("http://feeds.bbci.co.uk/mundo/rss.xml");

fetch(API_URL)
    .then(res => res.json())
    .then(data => {
        let html = "";

        data.items.forEach(noticia => {

            // Limpiar descripción de HTML
            let desc = noticia.description.replace(/<[^>]*>/g, "");
            if (desc.length > 150) desc = desc.substring(0, 150) + "...";

            // Extraer imagen si existe
            let img = noticia.thumbnail || "";

            html += `
                <div class="tarjetaNoticia">
                    ${img ? `<img src="${img}" class="imgNoti">` : ""}
                    <h3>${noticia.title}</h3>
                    <p>${desc}</p>
                    <a href="${noticia.link}" target="_blank" class="btnLeerMas">Leer más</a>
                </div>
            `;
        });

        cajaNoticias.innerHTML = html;
    })
    .catch(err => {
        console.error(err);
        cajaNoticias.innerHTML = "<p>Error al cargar las noticias. Intenta recargar la página.</p>";
    });
