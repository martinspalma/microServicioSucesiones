// === ESTADO Y VARIABLES DE CONTROL ===
let myChart = null;
let pasoActual = 0;
let ramasHereditarias = []; 
let tempNombreHijo = "";

const estadoSucesion = {
    testamento: false,
    legitima: 100,
    disponible: 0,
    hayConyuge: false,
    cantCabezas: 0 
};

const preguntas = [
    { id: 'testamento', texto: '¿Existe un testamento?', tipo: 'booleano', ayuda: 'La sucesión se abre por testamento o por ley [Art. 2277].' },
    { id: 'descendientes', texto: '¿Tiene hijos o descendientes?', tipo: 'booleano', ayuda: 'La porción legítima de los descendientes es de 2/3 [Art. 2445].' },
    { id: 'cant_hijos', texto: '¿Cuántos hijos tiene/tenía el causante?', tipo: 'numerico', ayuda: 'Los hijos heredan por partes iguales [Art. 2426].' },
    { id: 'conyuge', texto: '¿Existe cónyuge supérstite?', tipo: 'booleano', ayuda: 'El cónyuge concurre con descendientes o ascendientes [Art. 2433].' },
    { id: 'ascendientes', texto: '¿Viven los padres o ascendientes?', tipo: 'booleano', ayuda: 'Heredan a falta de descendientes [Art. 2431].' },
    { id: 'cant_ascendientes', texto: '¿Cuántos ascendientes viven?', tipo: 'numerico', ayuda: 'Dividen la herencia por partes iguales [Art. 2431].' }
];

// === INICIALIZACIÓN ===
function bootstrap() {
    const ctx = document.getElementById('inheritanceChart');
    if (ctx) {
        myChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Legítima', 'Disponible'],
                datasets: [{
                    data: [100, 0],
                    backgroundColor: ['#5a6268', '#ff8c00'],
                    borderWidth: 0
                }]
            },
            options: { cutout: '75%', plugins: { legend: { display: false } } }
        });
    }

    document.getElementById('btn-si').onclick = () => handleAnswer(true);
    document.getElementById('btn-no').onclick = () => handleAnswer(false);
    document.getElementById('btn-confirmar').onclick = () => handleAnswer(null);
    
    const btnTexto = document.getElementById('btn-confirmar-texto');
    if (btnTexto) btnTexto.onclick = () => handleAnswer(null);

    document.getElementById('ayuda-texto').textContent = preguntas[0].ayuda;
}

// === LÓGICA LEGAL [Representación Jerárquica] ===
function handleAnswer(respuesta) {
    const pActual = preguntas[pasoActual];

    // 1. TESTAMENTO
    if (pActual.id === 'testamento') {
        estadoSucesion.testamento = respuesta;
        estadoSucesion.legitima = respuesta ? 0 : 100;
        estadoSucesion.disponible = respuesta ? 100 : 0;
    }

    // 2. GESTIÓN DE HIJOS (TRONCOS)
    if (pActual.id === 'cant_hijos') {
        const cant = parseInt(document.getElementById('input-cant').value) || 0;
        for (let i = cant; i > 0; i--) {
            preguntas.splice(pasoActual + 1, 0,
                { id: 'nombre_hijo', nro: i, texto: `¿Cómo se llama el hijo ${i}?`, tipo: 'texto' },
                { id: 'hijo_vive', nro: i, texto: `¿Vive el hijo?`, tipo: 'booleano' }
            );
        }
    }

    if (pActual.id === 'nombre_hijo') {
        tempNombreHijo = document.getElementById('input-texto').value || `Hijo ${pActual.nro}`;
        preguntas[pasoActual + 1].texto = `¿${tempNombreHijo} vive al momento de la sucesión?`;
    }

    if (pActual.id === 'hijo_vive') {
        if (respuesta === true) {
            ramasHereditarias.push({ nombre: tempNombreHijo, tipo: 'hijo' });
            estadoSucesion.cantCabezas++;
        } else {
            preguntas.splice(pasoActual + 1, 0,
                { id: 'cant_nietos', nombrePadre: tempNombreHijo, texto: `¿Cuántos hijos tenía ${tempNombreHijo}?`, tipo: 'numerico' }
            );
        }
    }

    // 3. REPRESENTACIÓN (NIETOS Y BISNIETOS)
    if (pActual.id === 'cant_nietos') {
        const cantN = parseInt(document.getElementById('input-cant').value) || 0;
        if (cantN > 0) {
            let ramaNietos = { nombre: `Estirpe de ${pActual.nombrePadre}`, tipo: 'estirpe', integrantes: [] };
            for (let j = cantN; j > 0; j--) {
                preguntas.splice(pasoActual + 1, 0,
                    { id: 'nombre_nieto', nro: j, rama: ramaNietos, texto: `Nombre del nieto ${j}:`, tipo: 'texto' },
                    { id: 'nieto_vive', nro: j, rama: ramaNietos, texto: `¿Vive?`, tipo: 'booleano' }
                );
            }
            ramasHereditarias.push(ramaNietos);
            estadoSucesion.cantCabezas++;
        }
    }

    if (pActual.id === 'nombre_nieto') {
        pActual.tempN = document.getElementById('input-texto').value || `Nieto ${pActual.nro}`;
        preguntas[pasoActual + 1].texto = `¿${pActual.tempN} vive?`;
        preguntas[pasoActual + 1].nombreNieto = pActual.tempN;
    }

    if (pActual.id === 'nieto_vive') {
        if (respuesta === true) {
            pActual.rama.integrantes.push({ nombre: pActual.nombreNieto, tipo: 'derecho_propio' });
        } else {
            let subEstirpe = { nombre: `Sub-estirpe de ${pActual.nombreNieto}`, tipo: 'sub_estirpe', integrantes: [] };
            pActual.rama.integrantes.push(subEstirpe);
            preguntas.splice(pasoActual + 1, 0,
                { id: 'cant_bisnietos', subRama: subEstirpe, padre: pActual.nombreNieto, texto: `¿Cuántos hijos tenía ${pActual.nombreNieto}?`, tipo: 'numerico' }
            );
        }
    }

    if (pActual.id === 'cant_bisnietos') {
        const cantB = parseInt(document.getElementById('input-cant').value) || 0;
        for (let k = cantB; k > 0; k--) {
            preguntas.splice(pasoActual + 1, 0,
                { id: 'nombre_bisnieto', subRama: pActual.subRama, texto: `Nombre del bisnieto ${k} (hijo de ${pActual.padre}):`, tipo: 'texto' }
            );
        }
    }

    if (pActual.id === 'nombre_bisnieto') {
        const nombreB = document.getElementById('input-texto').value || "Bisnieto";
        pActual.subRama.integrantes.push(nombreB);
    }

    // 4. CONCURRENCIA Y LEGÍTIMAS
    if (pActual.id === 'descendientes') {
        if (respuesta) {
            if (estadoSucesion.testamento) { estadoSucesion.legitima = 66.6; estadoSucesion.disponible = 33.3; }
            const idx = preguntas.findIndex(p => p.id === 'ascendientes');
            if (idx !== -1) preguntas.splice(idx, 2);
        } else {
            const idx = preguntas.findIndex(p => p.id === 'cant_hijos');
            if (idx !== -1) preguntas.splice(idx, 1);
        }
    }

    if (pActual.id === 'conyuge' && respuesta) {
        estadoSucesion.cantCabezas++;
        estadoSucesion.hayConyuge = true;
        if (estadoSucesion.testamento && estadoSucesion.legitima < 50) { estadoSucesion.legitima = 50; estadoSucesion.disponible = 50; }
    }

    if (pActual.id === 'ascendientes' && respuesta) {
        if (estadoSucesion.testamento && estadoSucesion.legitima < 50) { estadoSucesion.legitima = 50; estadoSucesion.disponible = 50; }
    }

    updateUI();
    nextQuestion();
}

function nextQuestion() {
    pasoActual++;
    if (pasoActual < preguntas.length) {
        const p = preguntas[pasoActual];
        document.getElementById('question-text').textContent = p.texto;
        document.getElementById('ayuda-texto').textContent = p.ayuda || "";

        const boxBool = document.getElementById('options-bool');
        const boxNum = document.getElementById('options-num');
        const boxText = document.getElementById('options-text');

        boxBool.style.display = 'none'; boxNum.style.display = 'none'; boxText.style.display = 'none';

        if (p.tipo === 'numerico') { boxNum.style.display = 'flex'; document.getElementById('input-cant').value = 1; }
        else if (p.tipo === 'texto') { boxText.style.display = 'flex'; document.getElementById('input-texto').value = ""; document.getElementById('input-texto').focus(); }
        else { boxBool.style.display = 'flex'; }
    } else {
        mostrarResultadoFinal();
    }
}

function updateUI() {
    if (myChart) {
        myChart.data.datasets[0].backgroundColor = !estadoSucesion.testamento ? ['#ff8c00', '#ff8c00'] : ['#5a6268', '#ff8c00'];
        myChart.data.datasets[0].data = [estadoSucesion.legitima, estadoSucesion.disponible];
        myChart.update();
    }
    document.getElementById('legitima-val').textContent = Math.round(estadoSucesion.legitima) + '%';
    document.getElementById('disponible-val').textContent = Math.round(estadoSucesion.disponible) + '%';
}

function mostrarResultadoFinal() {
    const card = document.getElementById('question-card');
    
    // Cálculo de cuotas base (Cabezas)
    const divisorPropios = estadoSucesion.cantCabezas || 1;
    const porcionPropiosRama = estadoSucesion.legitima / divisorPropios;

    // En gananciales el cónyuge no hereda (Art. 2433)
    const divisorGananciales = estadoSucesion.hayConyuge ? (estadoSucesion.cantCabezas - 1) : estadoSucesion.cantCabezas;
    const porcionGanancialesRama = estadoSucesion.legitima / (divisorGananciales || 1);

    let html = `<h2>Informe de Hijuela Detallado</h2>`;
    html += `<p style="font-size:0.8rem; margin-bottom:15px; color:var(--text-muted);">Desglose por origen de bienes y derecho de representación.</p>`;
    
    html += `
    <table style="width:100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
        <thead>
            <tr style="border-bottom: 2px solid var(--accent); color: var(--accent);">
                <th style="padding: 10px;">Heredero / Estirpe</th>
                <th style="padding: 10px;">B. Propios</th>
                <th style="padding: 10px;">B. Gananciales*</th>
            </tr>
        </thead>
        <tbody>`;

    // 1. Cónyuge (si existe)
    if (estadoSucesion.hayConyuge) {
        html += `
            <tr style="background: rgba(255,140,0,0.05); border-bottom: 1px solid #444;">
                <td style="padding: 10px;">👤 <strong>Cónyuge</strong></td>
                <td style="padding: 10px;">${porcionPropiosRama.toFixed(1)}%</td>
                <td style="padding: 10px; color: #ff4444;">0%</td>
            </tr>`;
    }

    // 2. Descendientes (Hijos y Estirpes con detalle)
    ramasHereditarias.forEach(rama => {
        if (rama.tipo === 'hijo') {
            html += `
                <tr style="border-bottom: 1px solid #444;">
                    <td style="padding: 10px;">👤 <strong>${rama.nombre}</strong> (Hijo)</td>
                    <td style="padding: 10px;">${porcionPropiosRama.toFixed(1)}%</td>
                    <td style="padding: 10px;">${porcionGanancialesRama.toFixed(1)}%</td>
                </tr>`;
        } else {
            // DETALLE DE ESTIRPE (Nietos y Bisnietos)
            const cantSubCabezas = rama.integrantes.length || 1;
            const pPropioNieto = porcionPropiosRama / cantSubCabezas;
            const pGanancialNieto = porcionGanancialesRama / cantSubCabezas;

            // Fila de cabecera de la estirpe
            html += `
                <tr style="background: rgba(255,255,255,0.02);">
                    <td colspan="3" style="padding: 10px 10px 0 10px;">🚩 <strong>${rama.nombre}</strong> <small>(Total Rama: ${porcionPropiosRama.toFixed(1)}% P / ${porcionGanancialesRama.toFixed(1)}% G)</small></td>
                </tr>`;

            // Detalle de integrantes de la estirpe
            rama.integrantes.forEach(miembro => {
                if (miembro.tipo === 'derecho_propio') {
                    html += `
                        <tr style="border-bottom: 1px dotted #555; font-size: 0.8rem;">
                            <td style="padding: 5px 10px 5px 30px;">• ${miembro.nombre} (Nieto)</td>
                            <td style="padding: 5px 10px;">${pPropioNieto.toFixed(1)}%</td>
                            <td style="padding: 5px 10px;">${pGanancialNieto.toFixed(1)}%</td>
                        </tr>`;
                } else {
                    // Sub-estirpe (Bisnietos)
                    const cantBis = miembro.integrantes.length || 1;
                    const pPropioBis = pPropioNieto / cantBis;
                    const pGanancialBis = pGanancialNieto / cantBis;

                    html += `
                        <tr style="font-size: 0.8rem; color: var(--accent);">
                            <td colspan="3" style="padding: 5px 10px 0 35px;">└─ Sub-estirpe de ${miembro.nombre}</td>
                        </tr>`;
                    
                    miembro.integrantes.forEach(b => {
                        html += `
                            <tr style="border-bottom: 1px dotted #555; font-size: 0.75rem; font-style: italic;">
                                <td style="padding: 2px 10px 2px 50px;">- ${b.nombre} (Bisnieto)</td>
                                <td style="padding: 2px 10px;">${pPropioBis.toFixed(1)}%</td>
                                <td style="padding: 2px 10px;">${pGanancialBis.toFixed(1)}%</td>
                            </tr>`;
                    });
                }
            });
        }
    });

    html += `</tbody></table>`;
    
    // Notas legales al pie
    html += `
    <div style="margin-top: 20px; padding: 10px; border: 1px solid #444; border-radius: 4px;">
        <p style="font-size: 0.7rem; color: var(--text-muted); margin: 0;">
            * <strong>Nota sobre Gananciales:</strong> El porcentaje se aplica sobre la mitad (50%) del causante. El cónyuge supérstite conserva su 50% ganancial por derecho propio, el cual no forma parte de la herencia.
        </p>
    </div>
    <button class="btn-opt" onclick="location.reload()" style="margin-top:1.5rem; width:100%;">NUEVA CONSULTA</button>`;
    
    card.innerHTML = html;
}
document.addEventListener('DOMContentLoaded', bootstrap);
