// Variables globales
const formContainer = document.getElementById('form-container');
const loadingDiv = document.getElementById('loading');
const errorDiv = document.getElementById('error-message');
const resultadoContainer = document.getElementById('resultado-container');
const resultadoDiv = document.getElementById('resultado');
const prediccionesContainer = document.getElementById('predicciones-guardadas');
const listaPredicionesDiv = document.getElementById('lista-predicciones');

// Función principal de análisis
async function analizar(event) {
    event.preventDefault();
    
    const liga = document.getElementById('liga').value;
    const equipo1 = document.getElementById('equipo1').value;
    const equipo2 = document.getElementById('equipo2').value;

    // Mostrar loading y ocultar otros elementos
    formContainer.style.display = 'none';
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    resultadoContainer.style.display = 'none';

    try {
        const response = await fetch('http://localhost:3000/analizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ liga, equipo1, equipo2 })
        });

        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        // Mostrar resultado
        resultadoDiv.innerHTML = data.resultado;
        resultadoContainer.style.display = 'block';
        loadingDiv.style.display = 'none';

    } catch (error) {
        errorDiv.textContent = error.message || 'Error al realizar el análisis';
        errorDiv.style.display = 'block';
        loadingDiv.style.display = 'none';
        formContainer.style.display = 'block';
    }
}

// Función para guardar predicción
function guardarPrediccion() {
    const prediccion = {
        fecha: new Date().toLocaleString(),
        contenido: resultadoDiv.innerHTML,
        detalles: {
            liga: document.getElementById('liga').value,
            equipo1: document.getElementById('equipo1').value,
            equipo2: document.getElementById('equipo2').value
        }
    };

    const predicciones = JSON.parse(localStorage.getItem('predicciones') || '[]');
    predicciones.push(prediccion);
    localStorage.setItem('predicciones', JSON.stringify(predicciones));

    actualizarListaPredicciones();
    alert('Predicción guardada con éxito');
}

// Función para mostrar predicciones guardadas
function actualizarListaPredicciones() {
    const predicciones = JSON.parse(localStorage.getItem('predicciones') || '[]');
    
    if (predicciones.length === 0) {
        prediccionesContainer.style.display = 'none';
        return;
    }

    listaPredicionesDiv.innerHTML = '';
    predicciones.forEach((pred, index) => {
        const predDiv = document.createElement('div');
        predDiv.className = 'analisis-guardado';
        predDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 10px;">
                ${pred.fecha} - ${pred.detalles.liga}: ${pred.detalles.equipo1} vs ${pred.detalles.equipo2}
                <button onclick="eliminarPrediccion(${index})" 
                        style="float: right; background-color: #dc3545;">
                    Eliminar
                </button>
            </div>
            <div>${pred.contenido}</div>
        `;
        listaPredicionesDiv.appendChild(predDiv);
    });
    
    prediccionesContainer.style.display = 'block';
}

// Función para eliminar predicción
function eliminarPrediccion(index) {
    const predicciones = JSON.parse(localStorage.getItem('predicciones') || '[]');
    predicciones.splice(index, 1);
    localStorage.setItem('predicciones', JSON.stringify(predicciones));
    actualizarListaPredicciones();
}

// Función para nuevo análisis
function nuevoAnalisis() {
    formContainer.style.display = 'block';
    resultadoContainer.style.display = 'none';
    errorDiv.style.display = 'none';
    document.getElementById('analizarForm').reset();
}

// Event Listeners
document.getElementById('analizarForm').addEventListener('submit', analizar);
document.getElementById('guardar-apuesta').addEventListener('click', guardarPrediccion);
document.getElementById('nuevo-analisis').addEventListener('click', nuevoAnalisis);

// Cargar predicciones guardadas al iniciar
actualizarListaPredicciones();