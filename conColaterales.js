// === 1. ESTADO Y CONFIGURACIÓN ===
let myChart = null;
let pasoActual = 0;
let ramasHereditarias = [];
let tempNombreHijo = "";
let tempNombreNieto = "";
let tempNombreHermano = "";

const estadoSucesion = {
    testamento: false,
    legitima: 100,
    disponible: 0,
    hayConyuge: false,
    hayDescendientes: false,
    hayAscendientes: false,
    hayHermanos: false, // Agregado para control colateral
    vacante: false,
    cantCabezas: 0,
    cantAscendientes: 0
};

let preguntas = [
    { id: 'testamento', texto: '¿Existe un testamento?', tipo: 'booleano', ayuda: 'La sucesión se abre por testamento o por ley [Art. 2277].' },
    { id: 'descendientes', texto: '¿Tiene hijos o descendientes?', tipo: 'booleano', ayuda: 'La porción legítima de los descendientes es de 2/3 [Art. 2445].' },
    { id: 'cant_hijos', texto: '¿Cuántos hijos tiene/tenía el causante?', tipo: 'numerico', ayuda: 'Los hijos heredan por partes iguales [Art. 2426].' },
    { id: 'conyuge', texto: '¿Existe cónyuge supérstite?', tipo: 'booleano', ayuda: 'El cónyuge concurre con descendientes o ascendientes [Art. 2433].' }
];

// === 2. MANEJADOR DE RESPUESTAS ===
function handleAnswer(respuesta) {
    const pActual = preguntas[pasoActual];
    const valorNum = parseInt(document.getElementById('input-cant').value) || 0;
    const valorText = document.getElementById('input-texto').value.trim();

    switch (pActual.id) {
        // --- 1. CONFIGURACIÓN INICIAL ---
        case 'testamento':
            estadoSucesion.testamento = respuesta;
            break;

        // --- 2. LÍNEA DESCENDIENTE (Hijos, Nietos, Bisnietos) ---
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

        // --- 3. LÍNEA ASCENDIENTE Y CÓNYUGE ---
        case 'ascendientes':
            estadoSucesion.hayAscendientes = respuesta;
            if (respuesta) {
                inyectarPreguntaCantAscendientes();
            } else {
                inyectarPreguntaHermanos(); // Si no hay ascendientes, saltamos a colaterales [Art. 2431, 2438]
            }
            break;

        case 'cant_ascendientes':
            estadoSucesion.cantAscendientes = valorNum;
            estadoSucesion.cantCabezas += valorNum;
            break;

        case 'conyuge':
            estadoSucesion.hayConyuge = respuesta;
            if (respuesta) estadoSucesion.cantCabezas++;
            break;

        // --- 4. LÍNEA COLATERAL 2º Y 3º GRADO (Hermanos y Sobrinos) ---
        case 'hermanos':
            estadoSucesion.hayHermanos = respuesta;
            if (respuesta) {
                inyectarPreguntaCantHermanos();
            } else {
                inyectarPreguntaTios(); // Desplazamiento legal: Hermanos > Tíos [Art. 2439]
            }
            break;

        case 'cant_hermanos':
            inyectarPreguntasEstructuraHermanos(valorNum);
            break;

        case 'nombre_hermano':
            tempNombreHermano = valorText || `Hermano ${pActual.nro}`;
            preguntas[pasoActual + 1].texto = `¿${tempNombreHermano} es hermano de padre y madre (bilateral)?`;
            break;

        case 'es_bilateral':
            pActual.esBilateral = respuesta;
            preguntas[pasoActual + 1].texto = `¿${tempNombreHermano} vive actualmente?`;
            preguntas[pasoActual + 1].esBilateralRef = respuesta;
            break;

        case 'hermano_vive':
            if (respuesta) {
                ramasHereditarias.push({
                    nombre: tempNombreHermano,
                    tipo: 'hermano',
                    vinculo: pActual.esBilateralRef ? 'bilateral' : 'unilateral'
                });
                estadoSucesion.cantCabezas++;
            } else {
                inyectarPreguntaSobrinos(tempNombreHermano, pActual.esBilateralRef); // Derecho representación colateral [Art. 2439]
            }
            break;

        case 'cant_sobrinos':
            const ramaSobrinos = {
                nombre: `Estirpe de ${pActual.padreNombre}`,
                tipo: 'estirpe_colateral',
                vinculo: pActual.esBilateral ? 'bilateral' : 'unilateral',
                integrantes: []
            };
            inyectarNombresSobrinos(valorNum, ramaSobrinos, pActual.padreNombre);
            ramasHereditarias.push(ramaSobrinos);
            break;

        case 'nombre_sobrino':
            pActual.rama.integrantes.push({ nombre: valorText || "Sobrino", padreNombre: pActual.padre });
            break;

        // --- 5. LÍNEA COLATERAL 3º Y 4º GRADO (Tíos y otros) ---
        case 'hay_tios':
            if (respuesta) {
                preguntas.splice(pasoActual + 1, 0,
                    { id: 'cant_tios', texto: '¿Cuántos tíos vivos tiene el causante?', tipo: 'numerico' }
                );
            } else {
                inyectarPreguntaCuartoGrado(); // A falta de 3º grado, buscamos 4º grado [Art. 2438]
            }
            break;
        case 'nombre_vinculo_cuarto':
            // El valorText contendrá algo como "Juan Pérez - Primo"
            ramasHereditarias.push({
                nombre: valorText || `Pariente 4to grado ${pActual.nro}`,
                tipo: 'colateral_cuarto'
            });
            break;

        case 'cant_tios':
            inyectarNombresTios(valorNum);
            break;

        case 'nombre_tio':
            ramasHereditarias.push({
                nombre: valorText || `Tío/a ${pActual.nro}`,
                tipo: 'tio_tercer_grado'
            });
            break;

        case 'hay_cuarto_grado':
            if (respuesta) {
                preguntas.splice(pasoActual + 1, 0,
                    { id: 'cant_cuarto', texto: '¿Cuántos parientes de 4to grado viven?', tipo: 'numerico' }
                );
            } else {
                estadoSucesion.vacante = true;
                pasoActual = preguntas.length;
            }
            break;

        case 'cant_cuarto':
            inyectarNombresCuartoGrado(valorNum);
            break;        

        case 'vinculo_cuarto_grado':
            ramasHereditarias.push({
                nombre: tempNombreCuarto,
                tipo: 'colateral_cuarto',
                rolDetalle: respuesta
            });
            break;

        // --- 6. CIERRE Y VACANCIA ---
        case 'check_vacancia':
            if (respuesta) estadoSucesion.vacante = true; // Herencia vacante al Estado [Art. 2424]
            break;
    }

    recalcularLegitima();
    updateUI();
    nextQuestion();
}

// === 3. HELPERS DE FLUJO ===
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

function inyectarPreguntaHermanos() {
    preguntas.push({ id: 'hermanos', texto: '¿Tenía el causante hermanos?', tipo: 'booleano', ayuda: 'A falta de herederos forzosos, heredan los colaterales [Art. 2438].' });
}

function inyectarPreguntaCantHermanos() {
    preguntas.splice(pasoActual + 1, 0, { id: 'cant_hermanos', texto: '¿Cuántos hermanos tenía el causante?', tipo: 'numerico' });
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
        { id: 'cant_sobrinos', padreNombre: nombreHermano, esBilateral: esBilateral, texto: `¿Cuántos hijos (sobrinos) tenía ${nombreHermano}?`, tipo: 'numerico' }
    );
}

function inyectarNombresSobrinos(cant, rama, padre) {
    for (let i = cant; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_sobrino', rama: rama, padre: padre, texto: `Nombre del sobrino ${i} (hijo de ${padre}):`, tipo: 'texto' }
        );
    }
}

function inyectarPreguntaTios() {
    preguntas.push({
        id: 'hay_tios',
        texto: '¿Viven tíos del causante (hermanos de sus padres)?',
        tipo: 'booleano',
        ayuda: 'Los tíos son colaterales de 3er grado y heredan por derecho propio [Art. 2439].'
    });
}

function inyectarNombresTios(cant) {
    for (let i = cant; i > 0; i--) {
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_tio', nro: i, texto: `Nombre del tío/a ${i}:`, tipo: 'texto' }
        );
    }
}

function inyectarPreguntaCuartoGrado() {
    preguntas.push(
        {
            id: 'hay_cuarto_grado',
            texto: '¿Viven primos hermanos, sobrinos nietos o tíos abuelos?',
            tipo: 'booleano',
            ayuda: 'Estos son parientes de 4to grado. El grado más próximo excluye al más lejano [Art. 2439].'
        }
    );
}

function inyectarNombresCuartoGrado(cant) {
    for (let i = cant; i > 0; i--) {
        // 1. Pregunta para el Nombre
        preguntas.splice(pasoActual + 1, 0,
            { id: 'nombre_cuarto_grado', nro: i, texto: `Nombre del pariente ${i} (4to grado):`, tipo: 'texto' }
        );
        // 2. Pregunta para el Vínculo (Selección)
        preguntas.splice(pasoActual + 2, 0,
            {
                id: 'vinculo_cuarto_grado',
                texto: `¿Qué vínculo tiene con el causante?`,
                tipo: 'seleccion',
                opciones: ['Primo hermano', 'Sobrino nieto', 'Tío abuelo'],
                ayuda: 'Todos son parientes de 4to grado y heredan por partes iguales [Art. 2439].'
            }
        );
    }
}

// === 4. MOTOR DE CÁLCULO ===
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

    // 1. DESCENDIENTES: Heredan por derecho propio y partes iguales [Art. 2426]
    if (estadoSucesion.hayDescendientes) {
        const divisorPropios = estadoSucesion.cantCabezas || 1;
        const cuotaBasePropios = legitima / divisorPropios;
        const divisorGananciales = estadoSucesion.hayConyuge ? (estadoSucesion.cantCabezas - 1) : estadoSucesion.cantCabezas;
        const cuotaBaseGananciales = legitima / (divisorGananciales || 1);

        if (estadoSucesion.hayConyuge) {
            herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge', pTotal: cuotaBasePropios });
        }

        ramasHereditarias.forEach(rama => {
            if (rama.tipo === 'hijo') {
                herederosFinales.push({ nombre: rama.nombre, rol: 'Hijo', pTotal: cuotaBasePropios });
            } else {
                const estirpe = distribuirEstirpe(rama, cuotaBasePropios, cuotaBaseGananciales);
                estirpe.forEach(e => herederosFinales.push({ ...e, pTotal: e.pPropio }));
            }
        });
    } 
    // 2. ASCENDIENTES: A falta de descendientes [Art. 2431]
    else if (estadoSucesion.hayAscendientes) {
        const cuotaBase = estadoSucesion.hayConyuge ? (legitima / 2) : legitima;
        if (estadoSucesion.hayConyuge) herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge', pTotal: cuotaBase });
        
        const cuotaAsc = cuotaBase / (estadoSucesion.cantAscendientes || 1);
        for (let i = 1; i <= estadoSucesion.cantAscendientes; i++) {
            herederosFinales.push({ nombre: `Ascendiente ${i}`, rol: 'Padre/Madre', pTotal: cuotaAsc });
        }
    } 
    // 3. HERMANOS Y SOBRINOS: Desplazan a otros colaterales [Art. 2439]
    else if (estadoSucesion.hayHermanos) {
        let totalPuntos = 0;
        ramasHereditarias.forEach(r => {
            // Bilaterales heredan el doble que unilaterales [Art. 2440]
            totalPuntos += (r.vinculo === 'bilateral' ? 2 : 1);
        });
        const valorPunto = legitima / (totalPuntos || 1);

        ramasHereditarias.forEach(r => {
            const cuotaRama = valorPunto * (r.vinculo === 'bilateral' ? 2 : 1);
            if (r.tipo === 'hermano') {
                herederosFinales.push({ nombre: r.nombre, rol: `Hermano ${r.vinculo}`, pTotal: cuotaRama });
            } else {
                // Sobrinos por representación [Art. 2439]
                const cantSobrinos = r.integrantes.length || 1;
                r.integrantes.forEach(s => {
                    herederosFinales.push({ nombre: s.nombre, rol: 'Sobrino', padreNombre: s.padreNombre, pTotal: cuotaRama / cantSobrinos });
                });
            }
        });
    } 
    // 4. SÓLO CÓNYUGE: A falta de descendientes y ascendientes [Art. 2435]
    else if (estadoSucesion.hayConyuge) {
        herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge Supérstite', pTotal: legitima });
    }
    // 5. TÍOS (3er Grado): Heredan si no hay hermanos ni sobrinos [Art. 2439]
    else if (ramasHereditarias.some(r => r.tipo === 'tio_tercer_grado')) {
        const tios = ramasHereditarias.filter(r => r.tipo === 'tio_tercer_grado');
        const cuotaTio = legitima / tios.length;
        tios.forEach(t => {
            herederosFinales.push({ nombre: t.nombre, rol: 'Tío/a (3er grado)', pTotal: cuotaTio });
        });
    }
    // 6. 4TO GRADO: Primos, sobrinos nietos, tíos abuelos [Art. 2438, 2439]
    else if (ramasHereditarias.some(r => r.tipo === 'colateral_cuarto')) {
        const parientesCuarto = ramasHereditarias.filter(r => r.tipo === 'colateral_cuarto');
        const cuotaIndividual = legitima / parientesCuarto.length;
        parientesCuarto.forEach(p => {
            herederosFinales.push({ nombre: p.nombre, rol: p.rolDetalle || 'Pariente (4to grado)', pTotal: cuotaIndividual });
        });
    }

    return herederosFinales;
}
function distribuirEstirpe(rama, pPropioPadre, pGanancialPadre) {
    const cant = rama.integrantes.length || 1;
    const pPropioInd = pPropioPadre / cant;
    const pGanancialInd = pGanancialPadre / cant;
    const nombreHijoOriginal = rama.nombre.replace("Estirpe de ", "");

    let resultados = [];
    rama.integrantes.forEach(m => {
        if (m.tipo === 'derecho_propio') {
            resultados.push({ nombre: m.nombre, rol: 'Nieto', padreNombre: nombreHijoOriginal, pPropio: pPropioInd, pGanancial: pGanancialInd });
        } else {
            const nombreDelNietoPrefallecido = m.nombre;
            const cantBis = m.integrantes.length || 1;
            m.integrantes.forEach(b => {
                resultados.push({ nombre: b.nombre, rol: 'Bisnieto', padreNombre: nombreDelNietoPrefallecido, pPropio: pPropioInd / cantBis, pGanancial: pGanancialInd / cantBis });
            });
        }
    });
    return resultados;
}

// === 5. UI Y NAVEGACIÓN ===
function nextQuestion() {
    pasoActual++;
    if (pasoActual < preguntas.length) {
        const p = preguntas[pasoActual];
        document.getElementById('question-text').textContent = p.texto;

        // Ocultamos todos los contenedores de entrada
        const ids = ['options-bool', 'options-num', 'options-text', 'options-select'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        if (p.tipo === 'seleccion') {
            const container = document.getElementById('options-select');
            container.innerHTML = ""; // Limpiamos botones anteriores
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            p.opciones.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'btn-opt'; // Usamos tu clase de estilo
                btn.textContent = opt;
                btn.onclick = () => handleAnswer(opt); // Enviamos el texto del vínculo
                container.appendChild(btn);
            });
        } else {
            // Lógica normal para los otros tipos
            const boxes = { 'booleano': 'options-bool', 'numerico': 'options-num', 'texto': 'options-text' };
            const target = document.getElementById(boxes[p.tipo]);
            if (target) target.style.display = 'flex';

            if (p.tipo === 'texto') {
                const inputT = document.getElementById('input-texto');
                inputT.value = ""; inputT.focus();
            }
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
    const legEl = document.getElementById('legitima-val');
    const disEl = document.getElementById('disponible-val');
    if (legEl) legEl.textContent = Math.round(estadoSucesion.legitima) + '%';
    if (disEl) disEl.textContent = Math.round(estadoSucesion.disponible) + '%';
}

function mostrarResultadoFinal() {
    const herederos = calcularDistribucionCompleta();
    const tieneLegitimarios = estadoSucesion.hayDescendientes || estadoSucesion.hayAscendientes || estadoSucesion.hayConyuge;

    let html = `<h2>Informe de Hijuela Detallado</h2>`;

    if (!tieneLegitimarios && !estadoSucesion.vacante) {
        html += `<div style="background: rgba(255,140,0,0.1); border: 1px solid #ff8c00; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 0.8rem;">
                    <strong>Aviso Legal:</strong> No existen herederos legitimarios (forzosos). El causante posee libre disponibilidad del 100% de los bienes [Art. 2444].
                 </div>`;
    }

    if (estadoSucesion.vacante) {
        html += `<div style="text-align:center; padding: 20px;">
                    <h3 style="color:#ff8c00">HERENCIA VACANTE</h3>
                    <p>No se hallaron herederos hasta el 4to grado. Los bienes corresponden al Estado [Art. 2424].</p>
                 </div>`;
    } else {
        html += `<table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="color:#ff8c00; border-bottom:2px solid #ff8c00">
                        <th style="padding:10px; text-align:left;">Heredero / Estirpe</th>
                        <th style="padding:10px">Porcentaje Total</th>
                    </tr>
                </thead>
                <tbody>`;

        herederos.forEach(h => {
            let paddingLeft = "10px";
            let prefijo = "";
            let detalleParentesco = "";

            if (h.rol.includes('Nieto') || h.rol.includes('Sobrino') || h.rol.includes('Bisnieto')) {
                paddingLeft = h.rol.includes('Bisnieto') ? "50px" : "30px";
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
    const card = document.getElementById('question-card');
    if (card) card.innerHTML = html;
}

function bootstrap() {
    const canvas = document.getElementById('inheritanceChart');
    if (canvas && typeof Chart !== 'undefined') {
        myChart = new Chart(canvas, {
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


<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simulador Sucesiones | Microservicio</title>
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>

<body>
    <header class="navbar">
        <div class="navbar-content">
            <div class="brand">
                <i class="fas fa-balance-scale"></i>
                <span>Simulador Sucesiones</span>
            </div>
            
            <button class="hamburger" id="btn-hamburguesa">
                <i class="fas fa-bars"></i>
            </button>

            <nav class="nav-links" id="menu-links">
                <button type="button" class="nav-item" onclick="window.open('mapa.html', '_blank')">
                    <i class="fas fa-map"></i> Mapa Sucesorio
                </button>
                <button type="button" class="nav-item" onclick="window.open('grados.html', '_blank')">
                    <i class="fas fa-layer-group"></i> Mapa de Grados
                </button>
            </nav>
        </div>
    </header>

    <main class="app-container">
        <section class="wizard-section">
            <div id="question-card" class="card">
                <h2 id="question-text">¿Existe un testamento?</h2>
                
                <div id="options-bool" class="options">
                    <button class="btn-opt" id="btn-si">SÍ</button>
                    <button class="btn-opt" id="btn-no">NO</button>
                </div>

                <div id="options-select" style="display:none;"></div>

                <div id="options-num" class="options" style="display: none;">
                    <input type="number" id="input-cant" value="1" min="1" class="input-dark">
                    <button class="btn-opt" id="btn-confirmar">CONFIRMAR</button>
                </div>

                <div id="options-text" class="options" style="display: none;">
                    <input type="text" id="input-texto" placeholder="Ingrese nombre..." class="input-dark">
                    <button class="btn-opt" id="btn-confirmar-texto">CONFIRMAR</button>
                </div>
                
                <p id="ayuda-texto" class="ayuda"></p>
            </div>

            <div class="info-acervo">
                <p>
                    <i class="fas fa-balance-scale"></i>
                    <strong>Nota:</strong> El
                    <em>Acervo Hereditario</em> está compuesto por la totalidad de los <strong>bienes propios</strong>
                    del causante y el <strong>50% de los bienes gananciales</strong>.
                </p>
            </div>
        </section>

        <section class="visual-section">
            <div class="chart-box">
                <canvas id="inheritanceChart"></canvas>
            </div>
            <div id="summary">
                <p>Legítima: <span id="legitima-val">100%</span></p>
                <p>Disponible: <span id="disponible-val">0%</span></p>
            </div>
        </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="script.js"></script>
    <script>
        const btnMenu = document.getElementById('btn-hamburguesa');
        const menuLinks = document.getElementById('menu-links');

        btnMenu.addEventListener('click', () => {
            menuLinks.classList.toggle('active');
        });
    </script>
</body>
</html>