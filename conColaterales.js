// === 1. ESTADO Y CONFIGURACIÓN ===
let myChart = null;
let pasoActual = 0;
let ramasHereditarias = [];
let tempNombreHijo = "";
let tempNombreNieto = "";

const estadoSucesion = {
    testamento: false,
    legitima: 100,
    disponible: 0,
    hayConyuge: false,
    hayDescendientes: false,
    hayAscendientes: false,
    cantCabezas: 0,
    cantAscendientes: 0
};

let preguntas = [
    { id: 'testamento', texto: '¿Existe un testamento?', tipo: 'booleano', ayuda: 'La sucesión se abre por testamento o por ley [Art. 2277].' },
    { id: 'descendientes', texto: '¿Tiene hijos o descendientes?', tipo: 'booleano', ayuda: 'La porción legítima de los descendientes es de 2/3 [Art. 2445].' },
    { id: 'cant_hijos', texto: '¿Cuántos hijos tiene/tenía el causante?', tipo: 'numerico', ayuda: 'Los hijos heredan por partes iguales [Art. 2426].' },
    { id: 'conyuge', texto: '¿Existe cónyuge supérstite?', tipo: 'booleano', ayuda: 'El cónyuge concurre con descendientes o ascendientes [Art. 2433].' }
];

// Estas preguntas se añadirán al flujo si no hay herederos forzosos
const preguntasColaterales = [
    { id: 'hermanos', texto: '¿Tenía el causante hermanos?', tipo: 'booleano', ayuda: 'Los hermanos desplazan a los demás colaterales [Art. 2439].' },
    { id: 'cant_hermanos_bilaterales', texto: '¿Cuántos hermanos bilaterales (mismo padre y madre)?', tipo: 'numerico' },
    { id: 'cant_hermanos_unilaterales', texto: '¿Cuántos hermanos unilaterales (un solo padre/madre en común)?', tipo: 'numerico' },
    { id: 'otros_colaterales', texto: '¿Existen otros parientes hasta el 4to grado (tíos, primos, sobrinos nietos)?', tipo: 'booleano' },
    { id: 'grado_colateral', texto: '¿Cuál es el grado de parentesco más cercano que sobrevive?', tipo: 'numerico', ayuda: 'El grado más próximo excluye al más lejano [Art. 2439].' }
];

// === 2. MANEJADOR DE RESPUESTAS (Controlador) ===
function handleAnswer(respuesta) {
    const pActual = preguntas[pasoActual];
    const valorNum = parseInt(document.getElementById('input-cant').value) || 0;
    const valorText = document.getElementById('input-texto').value.trim();

    switch (pActual.id) {
        case 'testamento':
            estadoSucesion.testamento = respuesta;
            break;

        case 'descendientes':
            estadoSucesion.hayDescendientes = respuesta;
            if (!respuesta) {
                preguntas = preguntas.filter(p => p.id !== 'cant_hijos');
                inyectarPreguntaAscendientes();
            }
            break;

        case 'cant_hijos':
            inyectarHijos(valorNum);
            break;

        case 'nombre_hijo':
            tempNombreHijo = valorText || `Hijo ${pActual.nro}`;
            preguntas[pasoActual + 1].texto = `¿${tempNombreHijo} vive actualmente?`;
            break;

        case 'hijo_vive':
            if (respuesta) {
                ramasHereditarias.push({ nombre: tempNombreHijo, tipo: 'hijo' });
                estadoSucesion.cantCabezas++;
            } else {
                inyectarPreguntaNietos(tempNombreHijo);
            }
            break;

        case 'cant_nietos':
            const ramaNietos = { nombre: `Estirpe de ${pActual.nombrePadre}`, tipo: 'estirpe', integrantes: [] };
            inyectarNietos(valorNum, ramaNietos, pActual.nombrePadre);
            ramasHereditarias.push(ramaNietos);
            estadoSucesion.cantCabezas++;
            break;

        case 'nombre_nieto':
            tempNombreNieto = valorText || `Nieto ${pActual.nro}`;
            const nuevoNieto = { nombre: tempNombreNieto, tipo: 'derecho_propio' };
            pActual.rama.integrantes.push(nuevoNieto);
            preguntas[pasoActual + 1].texto = `¿${tempNombreNieto} vive?`;
            preguntas[pasoActual + 1].miembroRef = nuevoNieto;
            preguntas[pasoActual + 1].nombreNietoRef = tempNombreNieto;
            break;

        case 'nieto_vive':
            if (!respuesta) {
                pActual.miembroRef.tipo = 'sub_estirpe';
                pActual.miembroRef.integrantes = [];
                inyectarPreguntaBisnietos(pActual.miembroRef, pActual.nombreNietoRef);
            }
            break;

        case 'cant_bisnietos':
            inyectarBisnietos(valorNum, pActual.subRama, pActual.padreNombre);
            break;

        case 'nombre_bisnieto':
            pActual.subRama.integrantes.push({ nombre: valorText || "Bisnieto", tipo: 'final' });
            break;

        case 'ascendientes':
            estadoSucesion.hayAscendientes = respuesta;
            if (respuesta) {
                inyectarPreguntaCantAscendientes();
            } else {
                // Si no hay hijos ni padres, la ley llama a los colaterales [Art. 2438]
                inyectarPreguntaHermanos(); 
            }
            break;

        case 'cant_ascendientes':
            estadoSucesion.cantAscendientes = valorNum;
            estadoSucesion.cantCabezas += valorNum;
            // Si hay padres, los colaterales quedan excluidos [Art. 2431, 2438]
            break;

        case 'conyuge':
            estadoSucesion.hayConyuge = respuesta;
            if (respuesta) estadoSucesion.cantCabezas++;
            break;

        case 'hermanos':
    estadoSucesion.hayHermanos = respuesta;
    if (respuesta) {
        // Iniciamos la secuencia igual que con los hijos
        inyectarPreguntasEstructuraHermanos(valorNum);
    } else {
        inyectarPreguntaOtrosColaterales();
    }
    break;

case 'nombre_hermano':
    tempNombreHermano = valorText || `Hermano ${pActual.nro}`;
    preguntas[pasoActual + 1].texto = `¿${tempNombreHermano} es hermano de padre y madre (bilateral)?`;
    break;

case 'es_bilateral':
    // Guardamos el tipo de vínculo para el cálculo de puntos (Art. 2440)
    pActual.esBilateral = respuesta; 
    preguntas[pasoActual + 1].texto = `¿${tempNombreHermano} vive actualmente?`;
    break;

case 'hermano_vive':
    if (respuesta) {
        ramasHereditarias.push({ 
            nombre: tempNombreHermano, 
            tipo: 'hermano', 
            vinculo: pActual.esBilateral ? 'bilateral' : 'unilateral' 
        });
        estadoSucesion.cantCabezas++; 
    } else {
        // Si falleció, inyectamos la pregunta de sus hijos (sobrinos)
        inyectarPreguntaSobrinos(tempNombreHermano, pActual.esBilateral);
    }
    break;

        case 'otros_colaterales':
            if (respuesta) {
                preguntas.splice(pasoActual + 1, 0,
                    { id: 'grado_otros', texto: '¿Qué grado de parentesco tienen (3 tíos / 4 primos)?', tipo: 'numerico' },
                    { id: 'cant_otros', texto: '¿Cuántos son?', tipo: 'numerico' }
                );
            } else {
                // Si no hay parientes hasta el 4to grado, la herencia es vacante [Art. 2424]
                estadoSucesion.vacante = true; 
            }
            break;
    }

    recalcularLegitima();
    updateUI();
    nextQuestion();
}

// === 3. HELPERS DE FLUJO (Persistencia de Nombres) ===
function inyectarHijos(cant) {
    for (let i = cant; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_hijo', nro: i, texto: `¿Nombre del hijo ${i}?`, tipo: 'texto' },
            { id: 'hijo_vive', nro: i, texto: `¿Vive?`, tipo: 'booleano' }
        );
    }
}

function inyectarPreguntaNietos(padre) {
    preguntas.splice(pasoActual + 1, 0,
        { id: 'cant_nietos', nombrePadre: padre, texto: `¿Cuántos hijos tenía ${padre}?`, tipo: 'numerico' }
    );
}

function inyectarNietos(cant, rama, nombrePadre) {
    for (let i = cant; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_nieto', nro: i, rama: rama, padreNombre: nombrePadre, texto: `Nombre del nieto ${i}:`, tipo: 'texto' },
            { id: 'nieto_vive', nro: i, rama: rama, texto: `¿Vive?`, tipo: 'booleano' }
        );
    }
}

function inyectarPreguntaBisnietos(subRama, nombreNieto) {
    preguntas.splice(pasoActual + 1, 0,
        { id: 'cant_bisnietos', subRama: subRama, padreNombre: nombreNieto, texto: `¿Cuántos hijos tenía ${nombreNieto}?`, tipo: 'numerico' }
    );
}

function inyectarBisnietos(cant, subRama, nombrePadre) {
    for (let i = cant; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_bisnieto', subRama: subRama, padre: nombrePadre, texto: `Nombre del bisnieto ${i} (hijo de ${nombrePadre}):`, tipo: 'texto' }
        );
    }
}

function inyectarPreguntaAscendientes() {
    preguntas.push({ id: 'ascendientes', texto: '¿Viven los padres o ascendientes?', tipo: 'booleano' });
}

function inyectarPreguntaCantAscendientes() {
    preguntas.splice(pasoActual + 1, 0, { id: 'cant_ascendientes', texto: '¿Cuántos ascendientes viven?', tipo: 'numerico' });
}

// Inyecta la entrada a la línea colateral
function inyectarPreguntaHermanos() {
    preguntas.push({ 
        id: 'hermanos', 
        texto: '¿Tenía el causante hermanos?', 
        tipo: 'booleano', 
        ayuda: 'A falta de herederos forzosos, heredan los colaterales [Art. 2438].' 
    });
}

function inyectarPreguntasEstructuraHermanos(cant) {
    for (let i = cant; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_hermano', nro: i, texto: `¿Nombre del hermano ${i}?`, tipo: 'texto' },
            { id: 'es_bilateral', nro: i, texto: ``, tipo: 'booleano', ayuda: 'Bilaterales heredan el doble que unilaterales [Art. 2440].' },
            { id: 'hermano_vive', nro: i, texto: ``, tipo: 'booleano' }
        );
    }
}

function inyectarPreguntaSobrinos(nombreHermano, esBilateral) {
    preguntas.splice(pasoActual + 1, 0, 
        { 
            id: 'cant_sobrinos', 
            padreNombre: nombreHermano, 
            esBilateral: esBilateral,
            texto: `¿Cuántos hijos (sobrinos) tenía ${nombreHermano}?`, 
            tipo: 'numerico' 
        }
    );
}
// Inyecta la búsqueda de parientes hasta el 4to grado
function inyectarPreguntaOtrosColaterales() {
    preguntas.push(
        { 
            id: 'otros_colaterales', 
            texto: '¿Existen otros parientes hasta el 4to grado?', 
            tipo: 'booleano', 
            ayuda: 'Incluye tíos, primos hermanos y sobrinos nietos [Art. 2439].' 
        },
        { 
            id: 'check_vacancia', 
            texto: '¿No existe ningún pariente con derecho a heredar?', 
            tipo: 'booleano' 
        }
    );
}


// Función auxiliar que se disparará en el switch tras conocer la cantidad de hermanos con hijos
function inyectarDetalleSobrinos(cantHermanos) {
    for (let i = cantHermanos; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_hermano_representado', nro: i, texto: `¿Nombre del hermano fallecido ${i}?`, tipo: 'texto' },
            { id: 'cant_hijos_sobrinos', nro: i, texto: `¿Cuántos hijos (sobrinos) tenía ese hermano?`, tipo: 'numerico' }
        );
    }
}
// === 4. MOTOR DE CÁLCULO Y LÓGICA LEGAL ===
function recalcularLegitima() {
    if (!estadoSucesion.testamento) {
        estadoSucesion.legitima = 100;
        estadoSucesion.disponible = 0;
        return;
    }
    if (estadoSucesion.hayDescendientes) {
        estadoSucesion.legitima = 66.6;
        estadoSucesion.disponible = 33.3;
    } else if (estadoSucesion.hayConyuge || estadoSucesion.hayAscendientes) {
        estadoSucesion.legitima = 50;
        estadoSucesion.disponible = 50;
    } else {
        estadoSucesion.legitima = 0;
        estadoSucesion.disponible = 100;
    }
}

function calcularDistribucionCompleta() {
    let herederosFinales = [];
    const legitima = estadoSucesion.legitima;

    if (estadoSucesion.hayDescendientes) {
        const divisorPropios = estadoSucesion.cantCabezas || 1;
        const cuotaBasePropios = legitima / divisorPropios;
        const divisorGananciales = estadoSucesion.hayConyuge ? (estadoSucesion.cantCabezas - 1) : estadoSucesion.cantCabezas;
        const cuotaBaseGananciales = legitima / (divisorGananciales || 1);

        if (estadoSucesion.hayConyuge) {
            herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge', pPropio: cuotaBasePropios, pGanancial: 0 });
        }

        ramasHereditarias.forEach(rama => {
            if (rama.tipo === 'hijo') {
                herederosFinales.push({ nombre: rama.nombre, rol: 'Hijo', pPropio: cuotaBasePropios, pGanancial: cuotaBaseGananciales });
            } else {
                herederosFinales.push(...distribuirEstirpe(rama, cuotaBasePropios, cuotaBaseGananciales));
            }
        });
    } else if (estadoSucesion.hayAscendientes) {
        const cuotaBase = estadoSucesion.hayConyuge ? (legitima / 2) : legitima;
        if (estadoSucesion.hayConyuge) herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge', pPropio: cuotaBase, pGanancial: cuotaBase });
        const cuotaAsc = cuotaBase / (estadoSucesion.cantAscendientes || 1);
        for (let i = 1; i <= estadoSucesion.cantAscendientes; i++) {
            herederosFinales.push({ nombre: `Ascendiente ${i}`, rol: 'Padre/Madre', pPropio: cuotaAsc, pGanancial: cuotaAsc });
        }
    } else if (estadoSucesion.hayConyuge) {
        herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge Supérstite', pPropio: legitima, pGanancial: legitima });
    }
    return herederosFinales;
}

function distribuirEstirpe(rama, pPropioPadre, pGanancialPadre) {
    const cant = rama.integrantes.length || 1;
    const pPropioInd = pPropioPadre / cant;
    const pGanancialInd = pGanancialPadre / cant;
    let resultados = [];
    rama.integrantes.forEach(m => {
        if (m.tipo === 'derecho_propio') {
            resultados.push({ nombre: m.nombre, rol: 'Nieto', pPropio: pPropioInd, pGanancial: pGanancialInd });
        } else {
            const nombreDelPadre = m.nombre;
            const cantBis = m.integrantes.length || 1;
            m.integrantes.forEach(b => {
                resultados.push({ nombre: b.nombre, rol: 'Bisnieto', padreNombre: nombreDelPadre, pPropio: pPropioInd / cantBis, pGanancial: pGanancialInd / cantBis });
            });
        }
    });
    return resultados;
}

// === 4. UI Y NAVEGACIÓN ===
function nextQuestion() {
    pasoActual++;
    if (pasoActual < preguntas.length) {
        const p = preguntas[pasoActual];
        document.getElementById('question-text').textContent = p.texto;

        const boxes = { 'booleano': 'options-bool', 'numerico': 'options-num', 'texto': 'options-text' };
        ['options-bool', 'options-num', 'options-text'].forEach(id => document.getElementById(id).style.display = 'none');
        document.getElementById(boxes[p.tipo]).style.display = 'flex';

        if (p.tipo === 'texto') {
            const inputT = document.getElementById('input-texto');
            inputT.value = "";
            inputT.focus();
        } else if (p.tipo === 'numerico') {
            document.getElementById('input-cant').value = 1;
        }
    } else {
        mostrarResultadoFinal();
    }
}

function updateUI() {
    if (myChart) {
        myChart.data.datasets[0].data = [estadoSucesion.legitima, estadoSucesion.disponible];
        myChart.update();
    }
    document.getElementById('legitima-val').textContent = Math.round(estadoSucesion.legitima) + '%';
    document.getElementById('disponible-val').textContent = Math.round(estadoSucesion.disponible) + '%';
}

function mostrarResultadoFinal() {
    const herederos = calcularDistribucionCompleta();
    const conConyuge = estadoSucesion.hayConyuge;
    const conTestamento = estadoSucesion.testamento;
    
    // Verificamos si hay algún legitimario (forzoso)
    const tieneLegitimarios = estadoSucesion.hayDescendientes || 
                              estadoSucesion.hayAscendientes || 
                              estadoSucesion.hayConyuge;

    let html = `<h2>Informe de Hijuela Detallado</h2>`;
    
    // Mención si no hay herederos legítimos
    if (!tieneLegitimarios && !estadoSucesion.vacante) {
        html += `<div style="background: rgba(255,140,0,0.1); border: 1px solid var(--accent); padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 0.8rem;">
                    <strong>Aviso Legal:</strong> No existen herederos legitimarios (forzosos). 
                    El causante posee libre disponibilidad del 100% de los bienes [Art. 2444].
                 </div>`;
    }

    if (estadoSucesion.vacante) {
        html += `<div style="text-align:center; padding: 20px;">
                    <h3 style="color:var(--accent)">HERENCIA VACANTE</h3>
                    <p>No se hallaron herederos hasta el 4to grado. Los bienes corresponden al Estado [Art. 2424].</p>
                 </div>`;
    } else {
        html += `<table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="color:var(--accent); border-bottom:2px solid var(--accent)">
                        <th style="padding:10px; text-align:left;">Heredero / Estirpe</th>
                        <th style="padding:10px">Porcentaje Total</th>
                    </tr>
                </thead>
                <tbody>`;

        herederos.forEach(h => {
            let paddingLeft = "10px";
            let prefijo = "";
            let detalleParentesco = "";

            if (h.rol.includes('Nieto') || h.rol.includes('Sobrino')) {
                paddingLeft = "30px";
                prefijo = "└─ ";
                if (h.padreNombre) {
                    detalleParentesco = ` <span style="font-size:0.7rem; font-style:italic;">(hijo de ${h.padreNombre})</span>`;
                }
            }

            html += `<tr style="border-bottom:1px solid #444">
                     <td style="padding: 10px 10px 10px ${paddingLeft};">
                        <strong>${prefijo}${h.nombre}</strong>${detalleParentesco}<br>
                        <small>${h.rol}</small>
                     </td>
                     <td style="padding:10px; text-align:center;">${h.pTotal.toFixed(1)}%</td>
                     </tr>`;
        });

        html += `</tbody></table>`;
    }

    html += `<button class="btn-opt" onclick="location.reload()" style="margin-top:20px; width:100%">NUEVA CONSULTA</button>`;
    document.getElementById('question-card').innerHTML = html;
}
//+++++++++++++++++++++++++++++++++++++++++++++
//+++++++++DISTRIBUIR ESTIRPE+++++++++++++

function distribuirEstirpe(rama, pPropioPadre, pGanancialPadre) {
    const cant = rama.integrantes.length || 1;
    const pPropioInd = pPropioPadre / cant;
    const pGanancialInd = pGanancialPadre / cant;

    // Extraemos el nombre del hijo original (el tronco de la estirpe)
    // El nombre de la rama suele ser "Estirpe de [Nombre]"
    const nombreHijoOriginal = rama.nombre.replace("Estirpe de ", "");

    let resultados = [];
    rama.integrantes.forEach(m => {
        if (m.tipo === 'derecho_propio') {
            resultados.push({
                nombre: m.nombre,
                rol: 'Nieto',
                padreNombre: nombreHijoOriginal, // <--- Ahora el nieto sabe quién es su padre
                pPropio: pPropioInd,
                pGanancial: pGanancialInd
            });
        } else {
            const nombreDelNietoPrefallecido = m.nombre;
            const cantBis = m.integrantes.length || 1;
            m.integrantes.forEach(b => {
                resultados.push({
                    nombre: b.nombre,
                    rol: 'Bisnieto',
                    padreNombre: nombreDelNietoPrefallecido,
                    pPropio: pPropioInd / cantBis,
                    pGanancial: pGanancialInd / cantBis
                });
            });
        }
    });
    return resultados;
}
//+++++++++++++++++++++++++++++++++++++++++++++++++

function bootstrap() {
    const ctx = document.getElementById('inheritanceChart');
    if (ctx) {
        myChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Legítima', 'Disponible'], datasets: [{ data: [100, 0], backgroundColor: ['#5a6268', '#ff8c00'], borderWidth: 0 }] },
            options: { cutout: '75%', plugins: { legend: { display: false } } }
        });
    }
    const btnSi = document.getElementById('btn-si');
    const btnNo = document.getElementById('btn-no');
    const btnConf = document.getElementById('btn-confirmar');
    const btnConfTxt = document.getElementById('btn-confirmar-texto');

    if (btnSi) btnSi.onclick = () => handleAnswer(true);
    if (btnNo) btnNo.onclick = () => handleAnswer(false);
    if (btnConf) btnConf.onclick = () => handleAnswer(null);
    if (btnConfTxt) btnConfTxt.onclick = () => handleAnswer(null);
}
document.addEventListener('DOMContentLoaded', bootstrap);