// === 1. ESTADO Y CONFIGURACIÓN ===
let myChart = null;
let pasoActual = 0;
let ramasHereditarias = [];
let tempNombreHijo = "";
let tempNombreNieto = "";
let tempNombreHermano = "";

const estadoSucesion = {
    testamento: false,
    legitima: 0,
    disponible: 100,
    hayConyuge: false,
    hayDescendientes: false,
    hayAscendientes: false,
    hayHermanos: false, // Agregado para control colateral
    vacante: false,
    cantCabezas: 0,
    cantAscendientes: 0,
    disponible_testada: 0,       // Importante: inicializar en 0
    disponible_testada_final: 0, // Importante: inicializar en 0
    saldoAbIntestato: 100,       // Al principio, el saldo por ley es todo
    legitima: 0,
    totalNoDisponible: 100,
    bienesPropios: 100,      // Porcentaje del total que es propio
    bienesGananciales: 0,    // Porcentaje del total que es ganancial
    cuotaConyugePropio: 0,
    cuotaHijoPropio: 0,
    cuotaHijoGanancial: 0,
    alertaMostrada: false,
    mejoras2448: [],           // Array de objetos {nombre, vinculo, porcentaje}
    topeMejora2448: 0,         // Se calculará como legítima / 3
    totalMejorasAplicadas: 0,
    masaRepartoHerederos: 100,
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
            if (respuesta) {
                preguntas.splice(pasoActual + 1, 0, {
                    id: 'porcentaje_testado',
                    texto: '¿Qué porcentaje del acervo total se testó?',
                    tipo: 'rango', // Nuevo tipo
                    ayuda: 'Mueva el cursor para indicar el porcentaje del testamento.'
                });
            }
            break;

        case 'porcentaje_testado':
            // El valor vendrá del input range
            estadoSucesion.disponible_testada = parseInt(document.getElementById('input-range').value) || 0;
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
            inyectarPreguntaMejora2448();
            break;

        case 'conyuge':
            estadoSucesion.hayConyuge = respuesta;
            if (respuesta) estadoSucesion.cantCabezas++;
            if (estadoSucesion.hayDescendientes || estadoSucesion.hayAscendientes) {
                inyectarPreguntaMejora2448();
            }
            break;

        case 'clausula_2448':
            if (respuesta) {
                // Si dice que sí, el flujo se detiene para mostrar el formulario especial
                // Esta función debe renderizar la UI del "carrito" que diseñamos
                renderizarInterfazMejora();
                return; // Detenemos el nextQuestion() automático para que el usuario complete la mejora
            }
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
    procesarDisponibilidad();
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

function inyectarPreguntaMejora2448() {
    // Solo tiene sentido si hay una legítima sobre la cual aplicar el tercio
    if (estadoSucesion.hayDescendientes || estadoSucesion.hayAscendientes) {
        preguntas.splice(pasoActual + 1, 0, {
            id: 'clausula_2448',
            texto: '¿Se ha dispuesto una mejora a favor de herederos con discapacidad? [Art. 2448]',
            tipo: 'booleano',
            ayuda: 'Permite asignar hasta un tercio de la legítima a descendientes o ascendientes con discapacidad.'
        });
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
    // 1. Determinar la base de la Legítima según herederos
    let porcentajeLegitimaHerederos = 0;

    if (estadoSucesion.hayDescendientes) {
        porcentajeLegitimaHerederos = 66.6;
    } else if (estadoSucesion.hayConyuge || estadoSucesion.hayAscendientes) {
        porcentajeLegitimaHerederos = 50;
    } else {
        porcentajeLegitimaHerederos = 0;
    }

    // 2. Calcular el tope de la porción disponible
    let porcionDisponibleLey = 100 - porcentajeLegitimaHerederos;

    // 3. Manejo del Testamento y Reducción
    let testadoEfectivo = 0;
    if (estadoSucesion.testamento && estadoSucesion.disponible_testada > 0) {
        if (estadoSucesion.disponible_testada > porcionDisponibleLey) {
            // Alerta de Reducción
            // MODIFICACIÓN AQUÍ: Agregamos el check de la bandera
            if (!estadoSucesion.alertaMostrada) {
                alert(`El testamento excede la porción disponible (${porcionDisponibleLey}%). Se reducirá al tope legal.`);
                estadoSucesion.alertaMostrada = true; // Marcamos que ya se mostró
            }

            testadoEfectivo = porcionDisponibleLey;
            estadoSucesion.alertaReduccion = true; // Variable para el informe final
        } else {
            testadoEfectivo = estadoSucesion.disponible_testada;
            estadoSucesion.alertaReduccion = false;
            estadoSucesion.alertaMostrada = false;
        }
    }

    // 4. Distribución Final
    estadoSucesion.legitima = porcentajeLegitimaHerederos;
    estadoSucesion.disponible_testada_final = testadoEfectivo;

    // El saldo que no se testó y no es legítima estricta (Ab Intestato)
    estadoSucesion.saldoAbIntestato = porcionDisponibleLey - testadoEfectivo;

    // Para el gráfico y la UI general (Legítima + Saldo por Ley vs Testado)
    // Mostramos como "No disponible" todo lo que no es testamento válido
    estadoSucesion.totalNoDisponible = estadoSucesion.legitima + estadoSucesion.saldoAbIntestato;
}

//CALCULA DISTRIBUCION

function calcularDistribucionCompleta() {
    let herederosFinales = [];
    const masaBase = estadoSucesion.masaRepartoHerederos;

    // 1. DESCENDIENTES: Heredan por derecho propio y partes iguales [Art. 2426]
    if (estadoSucesion.hayDescendientes) {
        // La masa a repartir es la Legítima + lo que sobró por ley
        const masaARepartir = masaBase;

        // --- CÁLCULO SOBRE BIENES PROPIOS ---
        // Cónyuge entra como un hijo más (divisor = hijos + 1)
        const divisorPropios = (estadoSucesion.cantCabezas || 1);
        const cuotaPropioIndividual = masaARepartir / divisorPropios;

        // --- CÁLCULO SOBRE BIENES GANANCIALES ---
        // Cónyuge NO hereda. Si hay cónyuge, lo sacamos del divisor (divisor = hijos)
        const divisorGananciales = estadoSucesion.hayConyuge ? (estadoSucesion.cantCabezas - 1) : estadoSucesion.cantCabezas;
        const cuotaGanancialIndividual = masaARepartir / (divisorGananciales || 1);

        // --- ASIGNACIÓN FINAL ---
        // Ponderamos según el peso de cada tipo de bien en el patrimonio
        const pesoPropio = estadoSucesion.bienesPropios / 100;
        const pesoGanancial = estadoSucesion.bienesGananciales / 100;

        if (estadoSucesion.hayConyuge) {
            // El cónyuge solo suma su parte de los bienes propios
            const pTotalConyuge = (cuotaPropioIndividual * pesoPropio);
            herederosFinales.push({
                nombre: 'Cónyuge',
                rol: 'Cónyuge',
                pTotal: pTotalConyuge,
                detalle: "Hereda solo sobre bienes propios"
            });
        }

        ramasHereditarias.forEach(rama => {
            if (rama.tipo === 'hijo') {
                // El hijo suma su parte de propios + su parte de gananciales
                const pTotalHijo = (cuotaPropioIndividual * pesoPropio) + (cuotaGanancialIndividual * pesoGanancial);
                herederosFinales.push({
                    nombre: rama.nombre,
                    rol: 'Hijo',
                    pTotal: pTotalHijo,


                });
            } else {
                // Para estirpes (nietos), pasamos las cuotas base para que distribuyan internamente
                const estirpe = distribuirEstirpe(rama, cuotaPropioIndividual, cuotaGanancialIndividual);
                estirpe.forEach(e => {
                    const pTotalNieto = (e.pPropio * pesoPropio) + (e.pGanancial * pesoGanancial);
                    herederosFinales.push({ ...e, pTotal: pTotalNieto });
                });
            }
        });
    }
    // 2. ASCENDIENTES: A falta de descendientes [Art. 2431]
    else if (estadoSucesion.hayAscendientes) {
        const cuotaBase = estadoSucesion.hayConyuge ? (masaBase / 2) : masaBase;
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
        const valorPunto = masaBase / (totalPuntos || 1);

        ramasHereditarias.forEach(r => {
            const cuotaRama = valorPunto * (r.vinculo === 'bilateral' ? 2 : 1);
            if (r.tipo === 'hermano') {
                herederosFinales.push({ nombre: r.nombre, rol: `Hermano ${r.vinculo}`, pTotal: cuotaRama });
            } else {
                // Sobrinos por representación [Art. 2439]
                const cantSobrinos = r.integrantes.length || 1;
                const nombreHermanoOriginal = r.nombre.replace("Estirpe de ", "");
                r.integrantes.forEach(s => {
                    herederosFinales.push({ nombre: s.nombre, rol: 'Sobrino', padreNombre: nombreHermanoOriginal, pTotal: cuotaRama / cantSobrinos });
                });
            }
        });
    }
    // 4. SÓLO CÓNYUGE: A falta de descendientes y ascendientes [Art. 2435]
    else if (estadoSucesion.hayConyuge) {
        herederosFinales.push({ nombre: 'Cónyuge', rol: 'Cónyuge Supérstite', pTotal: masaBase });
    }
    // 5. TÍOS (3er Grado): Heredan si no hay hermanos ni sobrinos [Art. 2439]
    else if (ramasHereditarias.some(r => r.tipo === 'tio_tercer_grado')) {
        const tios = ramasHereditarias.filter(r => r.tipo === 'tio_tercer_grado');
        const cuotaTio = masaBase / tios.length;
        tios.forEach(t => {
            herederosFinales.push({ nombre: t.nombre, rol: 'Tío/a (3er grado)', pTotal: cuotaTio });
        });
    }
    // 6. 4TO GRADO: Primos, sobrinos nietos, tíos abuelos [Art. 2438, 2439]
    else if (ramasHereditarias.some(r => r.tipo === 'colateral_cuarto')) {
        const parientesCuarto = ramasHereditarias.filter(r => r.tipo === 'colateral_cuarto');
        const cuotaIndividual = masaBase / parientesCuarto.length;
        parientesCuarto.forEach(p => {
            herederosFinales.push({ nombre: p.nombre, rol: p.rolDetalle || 'Pariente (4to grado)', pTotal: cuotaIndividual });
        });
    }

    return herederosFinales;
}

function procesarDisponibilidad() {
    // 1. Definimos la base: ¿Cuánto es lo máximo que se puede testar?
    const porcionDisponibleLey = 100 - estadoSucesion.legitima;

    // 2. Calculamos el tope del Art. 2448 (1/3 de la legítima)
    estadoSucesion.topeMejora2448 = estadoSucesion.legitima / 3;

    // 3. Validamos la Mejora por Discapacidad
    let sumaMejoras = estadoSucesion.mejoras2448.reduce((acc, m) => acc + m.porcentaje, 0);
    if (sumaMejoras > estadoSucesion.topeMejora2448) {
        sumaMejoras = estadoSucesion.topeMejora2448;
        estadoSucesion.alertaMejoraReducida = true;
    }
    estadoSucesion.totalMejorasAplicadas = sumaMejoras;

    // 4. Validamos el Testamento (No puede tocar la legítima)
    if (estadoSucesion.disponible_testada > porcionDisponibleLey) {
        estadoSucesion.disponible_testada_final = porcionDisponibleLey;
        estadoSucesion.alertaReduccion = true;
    } else {
        estadoSucesion.disponible_testada_final = estadoSucesion.disponible_testada;
    }

    // 5. Calculamos el Saldo que sobra (Ab Intestato)
    estadoSucesion.saldoAbIntestato = porcionDisponibleLey - estadoSucesion.disponible_testada_final;

    // 6. MASA REPARTO HEREDEROS: El corazón del 100%
    // Es lo que queda para dividir entre los herederos en la tabla principal
    estadoSucesion.masaRepartoHerederos = 100 - estadoSucesion.disponible_testada_final - estadoSucesion.totalMejorasAplicadas;
}

function renderizarInterfazMejora() {
    // Calculamos cuánto queda del tercio de la legítima
    const totalMejorasActual = estadoSucesion.mejoras2448.reduce((acc, m) => acc + m.porcentaje, 0);
    const cupoDisponible = (estadoSucesion.topeMejora2448 - totalMejorasActual).toFixed(2);

    const card = document.getElementById('question-card');

    // Generamos la lista de herederos ya cargados para el datalist
    let opcionesHerederos = ramasHereditarias
        .filter(r => r.tipo === 'hijo' || r.tipo === 'estirpe' || r.tipo === 'padre/madre')
        .map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('');

    let html = `
        <div class="mejora-discapacidad-container">
            <h3>Gestión de Mejora (Art. 2448)</h3>
            <p style="font-size:0.85rem; margin-bottom:15px;">
                Cupo máximo (1/3 de legítima): <strong>${estadoSucesion.topeMejora2448.toFixed(2)}%</strong><br>
                Disponible: <span style="color:var(--accent); font-weight:bold;">${cupoDisponible}%</span>
            </p>

            <div id="lista-mejoras-agregadas" style="margin-bottom:15px;">
                ${renderizarListaMejoras()}
            </div>

            ${cupoDisponible > 0 ? `
                <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border: 1px dashed #555;">
                    <label style="display:block; margin-bottom:5px;">Nombre del Beneficiario:</label>
                    <input type="text" id="mejora-nombre" list="herederos-sugeridos" placeholder="Escriba o seleccione..." style="width:100%; margin-bottom:10px;">
                    <datalist id="herederos-sugeridos">${opcionesHerederos}</datalist>

                    <label style="display:block; margin-bottom:5px;">Vínculo Legal (Art. 2448):</label>
<select id="mejora-vinculo" style="width:100%; margin-bottom:10px; background:#222; color:white; padding:8px; border:1px solid #555;">
    <option value="Hijo/a">Hijo/a</option>
    <option value="Nieto/a">Nieto/a</option>
    <option value="Bisnieto/a">Bisnieto/a</option>
    <option value="Padre/Madre">Padre/Madre</option>
    <option value="Abuelo/a">Abuelo/a</option>
    <option value="Bisabuelo/a">Bisabuelo/a</option>
</select>

                    <label style="display:block; margin-bottom:5px;">Porcentaje (Máx ${cupoDisponible}%):</label>
                    <input type="range" id="mejora-rango" min="0" max="${cupoDisponible}" step="0.1" value="0" 
                           style="width:80%;" oninput="document.getElementById('display-val').textContent = this.value + '%'">
                    <span id="display-val" style="font-weight:bold; margin-left:10px;">0%</span>
                    
                    <button class="btn-opt" onclick="ejecutarGuardarMejora()" style="margin-top:10px; background:var(--accent);">+ AGREGAR MEJORA</button>
                </div>
            ` : '<p style="color:#ff4444; font-size:0.8rem;">Ha alcanzado el límite máximo de mejora legal.</p>'}

            <button class="btn-opt" onclick="finalizarMejoras()" style="margin-top:20px; width:100%; border: 1px solid #777;">CONTINUAR AL INFORME</button>
        </div>
    `;
    card.innerHTML = html;
}

function renderizarListaMejoras() {
    if (estadoSucesion.mejoras2448.length === 0) return "<p style='font-style:italic; font-size:0.8rem;'>No hay mejoras cargadas.</p>";

    return estadoSucesion.mejoras2448.map((m, index) => `
        <div style="display:flex; justify-content:space-between; background:#333; padding:8px; margin-bottom:5px; border-radius:4px; font-size:0.85rem;">
            <span><strong>${m.nombre}</strong> (${m.vinculo}): ${m.porcentaje}%</span>
            <span style="color:#ff4444; cursor:pointer;" onclick="eliminarMejora(${index})">✖</span>
        </div>
    `).join('');
}

function ejecutarGuardarMejora() {
    const nom = document.getElementById('mejora-nombre').value;
   const vinculoSeleccionado = document.getElementById('mejora-vinculo').value;
    const por = parseFloat(document.getElementById('mejora-rango').value);
    

    if (nom && por > 0) {
        estadoSucesion.mejoras2448.push({ nombre: nom, vinculo: vinculoSeleccionado, porcentaje: por });
        procesarDisponibilidad(); // Recalcula masaBase
        renderizarInterfazMejora(); // Refresca UI
    } else {
        alert("Por favor, ingrese un nombre y un porcentaje válido.");
    }
}

function eliminarMejora(index) {
    estadoSucesion.mejoras2448.splice(index, 1);
    procesarDisponibilidad();
    renderizarInterfazMejora();
}

function finalizarMejoras() {
    // Forzamos el avance del wizard al informe final
    pasoActual = preguntas.length;
    mostrarResultadoFinal();
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
        document.getElementById('ayuda-texto').textContent = p.ayuda || "";

        // 1. Ocultamos TODOS los contenedores (incluyendo el nuevo de rango)
        const ids = ['options-bool', 'options-num', 'options-text', 'options-select', 'options-range'];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        // 2. Lógica para el tipo SELECCIÓN (Botones dinámicos)
        if (p.tipo === 'seleccion') {
            const container = document.getElementById('options-select');
            container.innerHTML = "";
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            p.opciones.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'btn-opt';
                btn.textContent = opt;
                btn.onclick = () => handleAnswer(opt);
                container.appendChild(btn);
            });
        }
        // 3. Lógica para el tipo RANGO (Slider/Cursor)
        else if (p.tipo === 'rango') {
            const target = document.getElementById('options-range');
            const slider = document.getElementById('input-range');
            const display = document.getElementById('range-value');

            target.style.display = 'flex';

            // Resetear valores al mostrar
            slider.value = 0;
            display.textContent = "0";

            // Evento para actualizar el número mientras se arrastra el cursor
            slider.oninput = function () {
                display.textContent = this.value;
            };
        }
        // 4. Lógica para tipos estándar (Booleano, Numérico, Texto)
        else {
            const boxes = {
                'booleano': 'options-bool',
                'numerico': 'options-num',
                'texto': 'options-text'
            };
            const target = document.getElementById(boxes[p.tipo]);
            if (target) target.style.display = 'flex';

            // Foco automático si es texto
            if (p.tipo === 'texto') {
                const inputT = document.getElementById('input-texto');
                inputT.value = "";
                inputT.focus();
            }
            // Resetear valor si es numérico
            if (p.tipo === 'numerico') {
                document.getElementById('input-cant').value = 1;
            }
        }
    } else {
        mostrarResultadoFinal();
    }
}

function updateUI() {
    if (myChart) {
        myChart.data.datasets[0].data = [estadoSucesion.totalNoDisponible, estadoSucesion.disponible_testada_final];
        myChart.update();
    }
    // Actualizamos los textos
    const legLabel = document.getElementById('legitima-val');
    const dispLabel = document.getElementById('disponible-val');

    if (legLabel) {
        // Ejemplo: "80% (66% Legítima + 14% por Ley)"
        legLabel.innerHTML = `${Math.round(estadoSucesion.totalNoDisponible)}% <small>(${Math.round(estadoSucesion.legitima)}% Legítima + ${Math.round(estadoSucesion.saldoAbIntestato)}% por Ley)</small>`;
    }
    if (dispLabel) {
        dispLabel.textContent = Math.round(estadoSucesion.disponible_testada_final) + '% Testado';
    }
}

function mostrarResultadoFinal() {
    const herederos = calcularDistribucionCompleta();
    const tieneLegitimarios = estadoSucesion.hayDescendientes || estadoSucesion.hayAscendientes || estadoSucesion.hayConyuge;
    const porcTotalMejoras = estadoSucesion.totalMejorasAplicadas;

    // 1. Ocultamos la sección visual original
    const visualSection = document.querySelector('.visual-section');
    if (visualSection) visualSection.style.display = 'none';

    // 2. Preparamos los porcentajes para la barra lateral
    const hLeg = estadoSucesion.legitima || 0;
    const hLey = estadoSucesion.saldoAbIntestato || 0;
    const hTest = estadoSucesion.disponible_testada_final || 0;

    // 3. Construimos el encabezado del informe y alertas
    let headerHtml = `<h2>Informe de Hijuela Detallado</h2>`;

    if (estadoSucesion.alertaReduccion) {
        headerHtml += `<div style="background: rgba(255,0,0,0.1); border: 1px solid #ff4444; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 0.8rem; color: #ffbbbb;">
                        <strong>Nota de Reducción:</strong> Las disposiciones testamentarias excedían la porción disponible y fueron reducidas al tope legal.
                      </div>`;
    }

    if (!tieneLegitimarios && !estadoSucesion.vacante) {
        headerHtml += `<div style="background: rgba(255,140,0,0.1); border: 1px solid #ff8c00; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 0.8rem;">
                        <strong>Aviso Legal:</strong> No existen herederos legitimarios (forzosos). El causante posee libre disponibilidad del 100% de los bienes [Art. 2444].
                      </div>`;
    }

    let innerContent = "";

    if (estadoSucesion.vacante) {
        innerContent = `<div style="text-align:center; padding: 20px;">
                            <h3 style="color:#ff8c00">HERENCIA VACANTE</h3>
                            <p>No se hallaron herederos hasta el 4to grado. Los bienes corresponden al Estado [Art. 2424].</p>
                         </div>`;
    } else {
        // --- SECCIÓN 1: DISTRIBUCIÓN HEREDITARIA POR LEY ---
        const vistaDual = estadoSucesion.hayConyuge && estadoSucesion.hayDescendientes;
        innerContent += `<table style="width:100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 25px;">
                <thead>
                    <tr style="color:#ff8c00; border-bottom:2px solid #ff8c00">
                        <th style="padding:10px; text-align:left;">Heredero / Estirpe</th>
                        ${vistaDual
                        ? '<th style="padding:10px">B. Propios</th><th style="padding:10px">B. Gananciales</th>'
                        : '<th style="padding:10px">Porcentaje Total</th>'}
                    </tr>
                </thead>
                <tbody>`;

        herederos.forEach(h => {
            let paddingLeft = "10px";
            let prefijo = "";
            let detalleParentesco = "";
            let detalleExtra = "";

            if (h.rol === 'Cónyuge' && estadoSucesion.hayDescendientes) {
                detalleExtra = `<br><small style="color: var(--text-muted);">Hereda sobre bienes <strong>Propios</strong>. No sobre Gananciales.</small>`;
            } else if (h.rol === 'Hijo' && estadoSucesion.hayConyuge) {
                detalleExtra = `<br><small style="color: var(--text-muted);">Hereda sobre <strong>Propios</strong> y <strong>Gananciales</strong>.</small>`;
            }

            if (h.rol.includes('Nieto') || h.rol.includes('Sobrino') || h.rol.includes('Bisnieto')) {
                paddingLeft = h.rol.includes('Bisnieto') ? "50px" : "30px";
                prefijo = "└─ ";
                if (h.padreNombre) {
                    detalleParentesco = ` <span style="font-size:0.7rem; font-style:italic;">(hijo de ${h.padreNombre})</span>`;
                }
            }

            innerContent += `<tr style="border-bottom:1px solid #444">
                     <td style="padding: 10px 10px 10px ${paddingLeft};">
                        <strong>${prefijo}${h.nombre}</strong>${detalleParentesco}<br>
                        <small>${h.rol}</small>
                        ${detalleExtra} 
                     </td>`;

            if (vistaDual) {
                let pPropio = (h.rol === 'Cónyuge') ? h.pTotal : (h.pPropioInd || h.pTotal);
                let pGanancial = (h.rol === 'Cónyuge') ? 0 : (h.pGanancialInd || h.pTotal);
                innerContent += `<td style="padding:10px; text-align:center;">${pPropio.toFixed(1)}%</td>
                                 <td style="padding:10px; text-align:center;">${pGanancial.toFixed(1)}%</td>`;
            } else {
                innerContent += `<td style="padding:10px; text-align:center;">${h.pTotal.toFixed(1)}%</td>`;
            }
            innerContent += `</tr>`;
        });
        innerContent += `</tbody></table>`;

        // --- SECCIÓN 2: MEJORAS ART. 2448 ---
        if (estadoSucesion.mejoras2448 && estadoSucesion.mejoras2448.length > 0) {
            innerContent += `
                <div style="background: rgba(255, 140, 0, 0.05); border-left: 4px solid #b35900; padding: 15px; border-radius: 4px; margin-bottom: 25px;">
                    <h4 style="color: #ff8c00; margin-top: 0; margin-bottom: 10px; font-size: 0.9rem; text-transform: uppercase;">
                        Mejoras por Art. 2448 CCCN
                    </h4>
                    <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                        <thead>
                            <tr style="color:#ff8c00; border-bottom:1px solid rgba(255,140,0,0.3)">
                                <th style="padding:10px; text-align:left;">Beneficiario / Vínculo</th>
                                <th style="padding:10px; text-align:center;">Porcentaje Total</th>
                            </tr>
                        </thead>
                        <tbody>`;
            
            estadoSucesion.mejoras2448.forEach(m => {
                innerContent += `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                        <td style="padding: 10px;">
                            <strong>${m.nombre}</strong><br>
                            <small>${m.vinculo}</small>
                        </td>
                        <td style="padding:10px; text-align:center; font-weight:bold;">
                            ${m.porcentaje.toFixed(1)}%
                        </td>
                    </tr>`;
            });
            innerContent += `</tbody></table></div>`;
        }

        // --- SECCIÓN 3: DISPOSICIONES TESTAMENTARIAS ---
        if (estadoSucesion.testamento && hTest > 0) {
            innerContent += `
                <div style="background: rgba(0, 255, 204, 0.05); border-left: 4px solid var(--accent); padding: 15px; border-radius: 4px; margin-bottom: 20px;">
                    <h4 style="color: var(--accent); margin-top: 0; margin-bottom: 10px; font-size: 0.9rem; text-transform: uppercase;">
                        Legatarios / Testamento
                    </h4>
                    <table style="width:100%; border-collapse: collapse; font-size: 0.85rem;">
                        <tr>
                            <td style="padding:10px;">
                                <strong>Porción de Libre Disponibilidad</strong><br>
                                <small>Asignación sobre el total del acervo</small>
                            </td>
                            <td style="padding:10px; text-align:center; font-weight:bold; color:var(--accent);">
                                ${hTest.toFixed(1)}%
                            </td>
                        </tr>
                    </table>
                </div>`;
        }
    }

    // 4. ENSAMBLAJE FINAL
    const fullReportHtml = `
        <div style="max-width: 900px; margin: 0 auto; padding: 10px;">
            ${headerHtml}
            <div class="report-wrapper" style="display: flex; background: var(--card-bg); border: 1px solid #444; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                <div class="report-content" style="flex: 1; padding: 30px;">
                    ${innerContent}
                </div>
                <div class="report-sidebar-bar" style="width: 50px; display: flex; flex-direction: column; background: #1a1d23; border-left: 1px solid #444;">
                    <div class="bar-seg" style="height: ${hLeg}%; background: #5a6268; border-bottom: 1px solid #333;" title="Legítima"></div>
                    <div class="bar-seg" style="height: ${hLey}%; background: #888; border-bottom: 1px solid #333;" title="Saldo por Ley"></div>
                    <div class="bar-seg" style="height: ${porcTotalMejoras}%; background: #b35900; border-bottom: 1px solid #333;" title="Mejora Art. 2448"></div>
                    <div class="bar-seg" style="height: ${hTest}%; background: var(--accent);" title="Testamento"></div>
                </div>
            </div>
            <button class="btn-opt" onclick="location.reload()" style="margin-top:25px; width:100%; padding: 1rem;">NUEVA CONSULTA</button>
        </div>
    `;

    const card = document.getElementById('question-card');
    if (card) {
        card.style.maxWidth = "100%";
        card.innerHTML = fullReportHtml;
    }
}

function bootstrap() {
    const canvas = document.getElementById('inheritanceChart');


    // Vincular todos tus botones de index.html
    const btnConfRange = document.getElementById('btn-confirmar-range');
    if (btnConfRange) btnConfRange.onclick = () => handleAnswer(null);
    if (canvas && typeof Chart !== 'undefined') {
        myChart = new Chart(canvas, {
            type: 'doughnut',
            data: { labels: ['Legítima', 'Disponible'], datasets: [{ data: [0, 100], backgroundColor: ['#5a6268', '#ff8c00'], borderWidth: 0 }] },
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
    updateUI();
}
document.addEventListener('DOMContentLoaded', bootstrap);