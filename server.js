require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cheerio = require("cheerio");

const app = express();
app.use(express.json());
app.use(cors());

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const API_URL = "https://api.groq.com/openai/v1/chat/completions";

// Función mejorada para normalizar nombres con mayor tolerancia a errores
function normalizarTexto(texto) {
    if (!texto) return '';
    
    return texto.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
        .replace(/[^a-z0-9\s]/g, "") // Eliminar caracteres especiales
        .replace(/\s+/g, " ") // Normalizar espacios
        .trim();
}

// Función para encontrar la mejor coincidencia
function encontrarMejorCoincidencia(texto, opciones) {
    const textoNormalizado = normalizarTexto(texto);
    let mejorCoincidencia = null;
    let mejorPuntaje = 0;

    for (const opcion of Object.keys(opciones)) {
        const opcionNormalizada = normalizarTexto(opcion);
        
        // Verificar si el texto está contenido en la opción o viceversa
        if (opcionNormalizada.includes(textoNormalizado) || 
            textoNormalizado.includes(opcionNormalizada)) {
            const puntaje = Math.min(textoNormalizado.length, opcionNormalizada.length) / 
                          Math.max(textoNormalizado.length, opcionNormalizada.length);
            
            if (puntaje > mejorPuntaje) {
                mejorPuntaje = puntaje;
                mejorCoincidencia = opcion;
            }
        }
    }

    return mejorPuntaje > 0.5 ? mejorCoincidencia : null;
}

// Mapeo de ligas con variaciones comunes
const LIGAS = {
    'laliga': {
        variaciones: ['laliga', 'liga española', 'liga espanola', 'primera division', 'liga santander'],
        url: 'https://www.soccerstats.com/latest.asp?league=spain',
        nombreCompleto: 'LaLiga'
    },
    'premier': {
        variaciones: ['premier', 'premier league', 'liga inglesa', 'premier liga'],
        url: 'https://www.soccerstats.com/latest.asp?league=england',
        nombreCompleto: 'Premier League'
    },
    'serie a': {
        variaciones: ['serie a', 'seria a', 'liga italiana', 'calcio'],
        url: 'https://www.soccerstats.com/latest.asp?league=italy',
        nombreCompleto: 'Serie A'
    },
    'bundesliga': {
        variaciones: ['bundesliga', 'liga alemana', 'bundes'],
        url: 'https://www.soccerstats.com/latest.asp?league=germany',
        nombreCompleto: 'Bundesliga'
    },
    'ligue 1': {
        variaciones: ['ligue 1', 'liga francesa', 'lig 1', 'ligue one'],
        url: 'https://www.soccerstats.com/latest.asp?league=france',
        nombreCompleto: 'Ligue 1'

    },
    'ligue 2': {
        variaciones: ['ligue 2', 'liga francesa', 'lig 2', 'ligue two'],
        url: 'https://www.soccerstats.com/latest.asp?league=france2',
        nombreCompleto: 'Ligue 2'
    },
'Primera A': {
        variaciones: ['Primera A', 'primera a', 'primera a', 'primera a'],
        url: 'https://www.soccerstats.com/latest.asp?league=colombia',
        nombreCompleto: 'primera a'

    },

'liga profesional': {
        variaciones: ['liga profesional', 'liga profesional', 'liga profesional', 'liga profesional'],
        url: 'https://www.soccerstats.com/latest.asp?league=argentina',
        nombreCompleto: 'Ligue 2'



    },
    'champions': {
        variaciones: ['Champions league', 'champion leeague', 'liga de campeones', 'champions league'],
        url: 'https://www.soccerstats.com/leagueview.asp?league=cleague',
        nombreCompleto: 'Champions league'

    }
};

// Función para encontrar la liga correcta
function encontrarLiga(ligaUsuario) {
    const ligaNormalizada = normalizarTexto(ligaUsuario);
    
    for (const [liga, info] of Object.entries(LIGAS)) {
        if (info.variaciones.some(variacion => 
            normalizarTexto(variacion).includes(ligaNormalizada) || 
            ligaNormalizada.includes(normalizarTexto(variacion)))) {
            return info;
        }
    }
    return null;
}

async function obtenerPosicionEquipo(ligaUsuario, equipoUsuario) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        };

        const liga = encontrarLiga(ligaUsuario);

        if (!liga) {
            console.log(`❌ Liga no soportada: ${ligaUsuario}`);
            return `Liga no soportada. Ligas disponibles: ${Object.values(LIGAS).map(l => l.nombreCompleto).join(', ')}`;
        }

        console.log(`🔍 Buscando en: ${liga.url}`);

        const response = await axios.get(liga.url, { 
            headers,
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const equipoNormalizado = normalizarTexto(equipoUsuario);
        let posicion = null;
        let equiposEncontrados = new Set();

        // Recolectar todos los equipos disponibles
        $('table').each((_, table) => {
            $(table).find('tr').each((_, row) => {
                const equipoEnTabla = $(row).find('td:nth-child(2)').text().trim();
                if (equipoEnTabla) {
                    equiposEncontrados.add(equipoEnTabla);
                }
            });
        });

        // Convertir Set a Array y buscar la mejor coincidencia
        const equiposArray = Array.from(equiposEncontrados);
        const equiposBuscados = {};
        equiposArray.forEach(equipo => {
            equiposBuscados[equipo] = true;
        });

        const mejorCoincidencia = encontrarMejorCoincidencia(equipoUsuario, equiposBuscados);

        if (!mejorCoincidencia) {
            console.log(`❌ Equipo no encontrado: ${equipoUsuario}`);
            return `Equipo no encontrado en ${liga.nombreCompleto}`;
        }

        // Buscar la posición del equipo encontrado
        $('table').each((_, table) => {
            $(table).find('tr').each((index, row) => {
                if (index === 0) return;
                
                const equipoEnTabla = $(row).find('td:nth-child(2)').text().trim();
                if (equipoEnTabla === mejorCoincidencia) {
                    posicion = index;
                    return false;
                }
            });
            
            if (posicion !== null) return false;
        });

        return posicion;

    } catch (error) {
        console.error(`⚠️ Error en el scraping:`, error.message);
        if (error.code === 'ECONNABORTED') {
            return "Tiempo de espera agotado. Por favor, intente nuevamente.";
        }
        return `Error al buscar el equipo: ${error.message}`;
    }
}

app.post("/analizar", async (req, res) => {
    try {
        const { liga, equipo1, equipo2 } = req.body;

        if (!liga || !equipo1 || !equipo2) {
            return res.status(400).json({ 
                error: "Se requieren liga y nombres de equipos" 
            });
        }

        console.log(`🏆 Analizando partido: ${equipo1} vs ${equipo2} en ${liga}`);

        const [posicion1, posicion2] = await Promise.all([
            obtenerPosicionEquipo(liga, equipo1),
            obtenerPosicionEquipo(liga, equipo2)
        ]);

        if (typeof posicion1 === 'string' && posicion1.includes('Error')) {
            return res.status(500).json({ error: posicion1 });
        }
        if (typeof posicion2 === 'string' && posicion2.includes('Error')) {
            return res.status(500).json({ error: posicion2 });
        }

        const prompt = `
        Analiza el siguiente partido de fútbol y proporciona una predicción concisa con los siguientes datos clave:
        
        - **Liga**: ${liga}
        - **Equipos**: ${equipo1} (Posición ${posicion1}) vs ${equipo2} (Posición ${posicion2})
        
        ### Responde solo con:
        **Equipo favorito**: [Nombre del equipo]  
        **Probabilidad de victoria**: [Porcentaje]%  
        **Probabilidad de BTTS (ambos equipos marcan)**: [Porcentaje]%  
        **Probabilidad de más de 1.5 goles**: [Porcentaje]%  
        **Promedio de córners esperados**: [Número]  
        **Cuota recomendada**: [Valor numérico]  
    
        ⚠️ Responde únicamente en este formato, sin explicaciones adicionales ni análisis extenso.
        `;

        const response = await axios.post(
            API_URL,
            {
                model: "llama3-8b-8192",
                messages: [{ role: "system", content: prompt }],
                temperature: 0.7,
                max_tokens: 1000
            },
            {
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        res.json({ resultado: response.data.choices[0].message.content });

    } catch (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ 
            error: "Error en el análisis",
            detalles: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`));