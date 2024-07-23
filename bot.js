const { Telegraf, session, Scenes } = require('telegraf');
const { BaseScene, Stage } = Scenes;
const axios = require('axios');
const xml2js = require('xml2js'); // Utiliza 'xml2js' para parsear el XML
const { message } = require('telegraf/filters');

const bot = new Telegraf('7263558953:AAFeJz5Ja4Si6irNGCec2OUTUcpe1ESU7qM');

const MAX_SUBJECT_LENGTH = 50; // Número máximo de caracteres para el asunto

// Escena para pedir el nombre de usuario
const usernameScene = new BaseScene('usernameScene');
usernameScene.enter((ctx) => {
    const message = 'Hola, soy Lucy\\! \n Para empezar, por favor comparta la siguiente información: \n *Usuario para iniciar sesión en mesa de ayuda*';
    ctx.replyWithMarkdownV2(message);
});
usernameScene.on('text', async (ctx) => {
    const UserID = ctx.message.text;
    ctx.session.UserID = UserID;
    try {
        const response = await axios.post('http://192.168.10.83:8080/WPUser', { UserID });
        console.log(response.data);
        console.log('state:'+ctx.session.flowState2);
        const { ID, first_name, zcliente } = response.data;
        ctx.session.userData = { ID, first_name, zcliente };  // Guardar los datos en la sesión

         // Redirigir al nuevo flujo si zcliente es igual a 1 o 400065
        if (zcliente === '1' || zcliente === '400065') {
            ctx.scene.enter('analistaFlujoScene');
        } else {
            await ctx.reply(`${first_name}, ¿qué te gustaría hacer?`);
            ctx.scene.enter('menuScene');
        }
    } catch (error) {
        await ctx.reply('Hubo un error con el usuario ingresado. Por favor, inténtalo de nuevo.');
        ctx.scene.reenter();  // Reinicia la escena si hay un error
    }
});
usernameScene.on('message', (ctx) => ctx.reply('Por favor, escribe un nombre de usuario válido.'));

// Definir la nueva escena para el nuevo flujo
const analistaFlujoScene = new BaseScene('analistaFlujoScene');
analistaFlujoScene.enter((ctx) => {
    const nombre =ctx.session.userData.first_name;
    ctx.reply('Bienvenido, analista '+ nombre + ' . ¿Qué te gustaría hacer? \n1. Consultar los detalles de uno de mis casos \n2. Agregar un comentario a uno de mis casos \n3. Cambiar el estado de uno de mis casos');
});
analistaFlujoScene.on('text', (ctx) => {
    // Lógica para manejar el nuevo flujo
    const option = ctx.message.text;
    ctx.session.option = option;
    if (option === '1') {
        ctx.session.option = option;
        ctx.scene.enter('consultarCasosAnalistaScene');
    } else if (option === '2') {
        ctx.session.option = option;
        ctx.scene.enter('consultarCasosAnalistaScene');
    }else if (option === '3'){
        ctx.session.option = option;
        ctx.scene.enter('consultarCasosAnalistaScene');
    } else {
        ctx.reply('Por favor, elige una opción válida (1, 2 o 3).');
        ctx.scene.reenter();
    };
});

const consultarCasosAnalistaScene = new BaseScene('consultarCasosAnalistaScene');
consultarCasosAnalistaScene.enter(async (ctx) => {
    let itemsConsulta = [];
    const UserID = ctx.session.UserID;
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPConsulta', { UserID });
        console.log('Datos enviados correctamente:', response.data);
        const listaG = response.data;
         // Convertir entidades HTML a caracteres normales
         listaConsulta = listaG.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
         console.log('lista:' + listaConsulta);

         // Expresiones regulares para extraer los valores de 'id' y 'sym'
         let refNumRegex = /<AttrName>ref_num<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let refNum = extractValues(refNumRegex, listaConsulta);
         console.log('ref:' + refNum);
          
         // Crear una lista con los valores
         for (let i = 0; i < refNum.length; i++) {
            itemsConsulta.push({
                item: i + 1,
                id: refNum[i]
            });
        };
        console.log('estado:'+ JSON.stringify(itemsConsulta));
        ctx.session.itemsConsulta = itemsConsulta;
         if(itemsConsulta != ''){
                ctx.scene.enter('opcionesCasoScene');
         }
         else{
            await ctx.reply('No se encontraron casos relacionados a la cuenta. Terminando la solicitud...');
            ctx.scene.enter('usernameScene');
         };
    } catch (error) {
        await ctx.reply('   ');
        ctx.scene.enter('usernameScene');
    }
});

const opcionesCasoScene = new BaseScene('opcionesCasoScene');
opcionesCasoScene.enter((ctx) =>{
    let rtaCasosUser = ctx.session.itemsConsulta;
    let nombre = ctx.session.userData.first_name;
    let message = '';
    let option = ctx.session.option;
    
    for(let i=0; i < rtaCasosUser.length; i++) {

            message += rtaCasosUser[i].item + '. ' + rtaCasosUser[i].id + '\n';
    };
    
    if(option==='1'){
        ctx.reply(nombre+ ', estos son los casos activos actualmente: \n' + message + '\n Escribe el número del ítem del caso el cual desea saber más detalles.');
    }
    else if(option==='2'){
        ctx.reply(nombre+ ', estos son los casos activos actualmente: \n' + message + '\n Escribe el número del ítem del caso el cual desea agregar un comentario.');
    }
    else if(option==='3'){
        ctx.reply(nombre+ ', estos son los casos activos actualmente: \n' + message + '\n Escribe el número del ítem del caso el cual desea cambiar el estado.');
    }
    
});
opcionesCasoScene.on('text', async (ctx) =>{
    let eleccion = parseInt(ctx.message.text);
    let encontrado = false;
    let lista = ctx.session.itemsConsulta;
    let option = ctx.session.option;
    for (let i = 0; i < lista.length; i++){
        if(lista[i].item == eleccion ){ 
            encontrado = true;
            let caso = lista[i].id;
            ctx.session.caso = caso;
            ctx.scene.enter('detalleCasoAnalistaScene');
            
        };
    };
    if(!encontrado){
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    };
});

const detalleCasoAnalistaScene = new BaseScene('detalleCasoAnalistaScene');
detalleCasoAnalistaScene.enter(async (ctx) =>{
    let ref_num = ctx.session.caso;
    try{    
        const response = await axios.post('http://192.168.10.83:8080/WPConsultaDetalle', { ref_num });
        console.log('Datos enviados correctamente:', response.data);
        ctx.session.contenido = response.data;
        const option = ctx.session.option;
        if(option==='1'){
            ctx.scene.enter('postDetalleAnalistaScene');
        }
        else if(option==='2'){
            ctx.scene.enter('agregarComentarioAnalistaScene');
        }
        else if(option==='3'){
            ctx.scene.enter('listaEstadoAnalistaScene');
        };
        
    }catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('usernameScene'); // Salir de la escena después de crear caso;
    };
});

const postDetalleAnalistaScene = new BaseScene('postDetalleAnalistaScene');
postDetalleAnalistaScene.enter((ctx) =>{
    let nombre = ctx.session.userData.first_name;
    const contenido = ctx.session.contenido;
    console.log('ref_num:'+ contenido.ref_num);
    let message= ' Numero de referencia: ' + contenido.ref_num + '\n Descripción: ' + contenido.summary + '\n Estado: '+ contenido.status + '\n Solución: '+ contenido.cat;
    ctx.reply(nombre + ', estos son los detalles del caso seleccionado: \n \n'+ message + '\n \n¿Desea realizar alguna otra solicitud? (Sí/No)');
});
postDetalleAnalistaScene.on('text', async (ctx) =>{
    let decision = ctx.message.text;
    if(['si','Sí','SI','Si','SÍ','Yes','yes'].includes(decision)){
        await ctx.reply('Entendido! Volviendo al menú principal');
        ctx.scene.enter('analistaFlujoScene');
    }
    else if (['No','no','NO'].includes(decision)) {
        await ctx.reply('Terminando la solicitud. Gracias por usar nuestros servicios!');
        ctx.session= {};
        ctx.scene.leave()
    } else {
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    };
});

const agregarComentarioAnalistaScene = new BaseScene('agregarComentarioAnalistaScene');
agregarComentarioAnalistaScene.enter((ctx) => {
    ctx.reply('¿Cuál es el comentario a agregar?');
});
agregarComentarioAnalistaScene.on('text', async(ctx) =>{
    ctx.session.comentario = ctx.message.text;
    console.log('texto:'+ ctx.session.comentario);
    await ctx.reply('Procesando solicitud...');
    ctx.scene.enter('comentandoScene');
});

const comentandoScene = new BaseScene('comentandoScene');
comentandoScene.enter(async (ctx) => {
    const contenido = ctx.session.contenido;
    console.log(contenido.cr);
    const msg = {
        cr: contenido.cr,
        comentario: ctx.session.comentario
    };
    console.log(msg);
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPAgregarComentario',  msg );
        console.log('Datos enviados correctamente:', response.data);
        ctx.session.contenidoComentario = response.data;
         ctx.scene.enter('postComentarioAnalistaScene');
        
    }catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('analistaFlujoScene'); // Salir de la escena después de crear caso;
    };
});

const postComentarioAnalistaScene = new BaseScene('postComentarioAnalistaScene');
postComentarioAnalistaScene.enter((ctx) =>{
    let nombre = ctx.session.userData.first_name;
    let ref = ctx.session.contenido.ref_num;
    ctx.reply(nombre + ', su comentario para el caso '+ ref+' fue exitosamente registrado! \n \n¿Desea realizar alguna otra solicitud? (Sí/No)');
});
postComentarioAnalistaScene.on('text', async (ctx) =>{
    let decision = ctx.message.text;
    if(['si','Sí','SI','Si','SÍ','Yes','yes'].includes(decision)){
        await ctx.reply('Entendido! Volviendo al menú principal');
        ctx.scene.enter('analistaFlujoScene');
    }
    else if (['No','no','NO'].includes(decision)) {
        await ctx.reply('Terminando la solicitud. Gracias por usar nuestros servicios!');
        ctx.session= {};
        ctx.scene.leave();
    } else {
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    };
});

const listaEstadoAnalistaScene = new BaseScene('listaEstadoAnalistaScene');
listaEstadoAnalistaScene.enter(async (ctx)=>{
    let itemsEstados = [];
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPEstados');
        console.log('Datos enviados correctamente:', response.data);
        const listaG = response.data;
        // Convertir entidades HTML a caracteres normales
        let listaConsulta = decodeHtmlEntities(listaG.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
        console.log('lista:' + listaConsulta);

        // Expresiones regulares para extraer los valores de 'sym'
        let symRegex = /<AttrName>sym<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
        let estados = extractValues(symRegex, listaConsulta);
        console.log('estados:' + estados);

        // Expresión regular para extraer los valores de 'crs'
        let crsRegex = /<Handle>(crs:\d+)<\/Handle>/g;
        let crsValues = extractValues(crsRegex, listaConsulta);
        console.log('crsValues:', crsValues);

        // Crear una lista con los valores
        for (let i = 0; i < estados.length; i++) {
            itemsEstados.push({
                item: i + 1,
                estado: estados[i],
                crs: crsValues[i]
            });
        }
        console.log('itemsEstados:' + JSON.stringify(itemsEstados));
        ctx.session.itemsEstados = itemsEstados;

        if (itemsEstados.length > 0) {
            // Responder al usuario con la lista de estados
            let replyMessage = 'Escribe el número del ítem del nuevo estado a asignar para el caso seleccionado|:\n';
            itemsEstados.forEach(item => {
                replyMessage += `${item.item}. ${item.estado}\n`;
            });
            await ctx.reply(replyMessage);
        } else {
            await ctx.reply('No se encontraron estados. Volviendo al menú.');
            ctx.scene.enter('menuScene'); // Salir de la escena
        }

        
    }catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('analistaFlujoScene'); // Salir de la escena después de crear caso;
    };
});
listaEstadoAnalistaScene.on('text', async(ctx) => {
    let lista = ctx.session.itemsEstados;
    const eleccion = ctx.message.text;
    let encontrado = false;
    for (let i = 0; i < lista.length; i++){
        if(lista[i].item == eleccion ){ 
            encontrado = true;
            let decodedSym = lista[i].estado;
            let crs = lista[i].crs;
            ctx.session.estadoNuevo = decodedSym;
            ctx.session.crs = crs;
            ctx.scene.enter('cambioEstadoScene');
        };
    };
    if(!encontrado){
        ctx.reply('Por favor, elige una opción válida.');
        ctx.scene.reenter(); 
    };
});

const cambioEstadoScene = new BaseScene('cambioEstadoScene');
cambioEstadoScene.enter( (ctx) =>{
    ctx.reply('Ahora escribe el motivo del cambio de estado:');
});
cambioEstadoScene.on('text', async (ctx) =>{
    const contenido = ctx.session.contenido;
    const motivo = ctx.message.text;
    const cnt = ctx.session.userData.ID;
    const crs = ctx.session.crs;
    const msg = {
        motivo: motivo,
        cnt: cnt,
        cr: contenido.cr,
        crs: crs
    };
    console.log(msg);
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPCambioEstado',  msg );
        console.log('Datos enviados correctamente:', response.data);
        ctx.scene.enter('postCambioEstadoScene');
    }catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('analistaFlujoScene'); // Salir de la escena después de crear caso;
    };
});

const postCambioEstadoScene = new BaseScene('postCambioEstadoScene');
postCambioEstadoScene.enter((ctx) =>{
    const estado = ctx.session.estadoNuevo;
    const ref_num = ctx.session.contenido.ref_num;
    ctx.reply('El cambio de estado a '+ estado + ' para el caso ' + ref_num + ' fue exitoso! ¿Desea realizar alguna otra solicitud? (Sí/No)');
})
postCambioEstadoScene.on('text', async (ctx) =>{
    let decision = ctx.message.text;
    if(['si','Sí','SI','Si','SÍ','Yes','yes'].includes(decision)){
        await ctx.reply('Entendido! Volviendo al menú principal');
        ctx.scene.enter('analistaFlujoScene');
    }
    else if (['No','no','NO'].includes(decision)) {
        await ctx.reply('Terminando la solicitud. Gracias por usar nuestros servicios!');
        ctx.session= {};
        ctx.scene.leave()
    } else {
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    };
});


// Escena para el menú principal de los clientes
const menuScene = new BaseScene('menuScene');
menuScene.enter((ctx) => ctx.reply('Por favor, elige una opción: \n1. Consultar tus casos \n2. Crear un caso'));
menuScene.on('text', (ctx) => {
    const option = ctx.message.text;
    if (option === '1') {
        ctx.scene.enter('consultarCasosScene');
    } else if (option === '2') {
        ctx.scene.enter('crearCasoScene');
    } else {
        ctx.reply('Por favor, elige una opción válida (1 o 2).');
        ctx.scene.reenter();
    }
});

// Escena para consultar casos
const crearCasoScene = new BaseScene('crearCasoScene');
crearCasoScene.enter(async (ctx) => {
    const zcliente = ctx.session.userData.zcliente;
    console.log('zcliente: '+ zcliente);
    switch (zcliente) {
        case "400020": // SDH
                    categoria="400168,400169,400051,400165,400166,400167,400053,400052,400168";
                    break;
                case "400024": // TIGO-UNE
                    categoria="400163,400001,400002,400101,400160,400163";
                    break;
                case "400017": // DNP
                    categoria="400052,400051,400053,400165,400166,400167,400052";
                    break;
            case "400078": // BURO
                    categoria="400160,400161,400160";
                    break;
            case "400027": // TELEFÓNICA
                    categoria="400002,400308,400002";
                    break;	
            case "400002": // SURA
                    categoria="400001,400002,400101,400160,400163,400001";
                    break;	
            case "400030": // SONDA
                    categoria="400168,400168";
                    break;	
            case "400023": // SNR
                    categoria="400051,400053,400001,400002,400101,400163,400160,400168,400173,400174,400052,400175,400176,400258,400051";
                    break;
            case "400031": // Skynet
                    categoria="400175,400175";
                    break;
            case "400074": // SENA
                    categoria="400002,400002";
                    break;	
            case "400029": // SEFIN
                    categoria="400001,400002,400160,400163,400001";
                    break;	
            case "400026": // POLICIA
                    categoria="400002,400002";
                    break;
            case "400079": // PGN
                    categoria="400001,400002,400101,400160,400161,400162,400163,400168,400169,400172,400173,400174,400001";
                    break;
            case "400001": // MINHACIENDA
                    categoria="400168,400169,400168";
                    break;	
            case "400006": // MinCiencias
                    categoria="400051,400165,400166,400167,400053,400052,400168,400169,400170,400160,400051";
                    break;
            case "400018": // MinAgricultura
                    categoria="400175,400176,400175";
                    break;	
            case "400071": // MEN
                    categoria="400001,400101,400001,400002,400051,400053,400166,400167,400169,400168,400172,400001";
                    break;	
            case "400067": // LUBI
                    categoria="400165,400166,400167,400051,400173,400165";
                    break;
            case "400069": // LUBI
                    categoria="400165,400166,400167,400051,400173,400165";
                    break;	
            case "400032": // JEP
                    categoria="400158,400002,400168,400408,400158";
                    break;	
            case "400021": // ILUMNO
                    categoria="400051,400167,400053,400051";
                    break;	
            case "400072": // Frontera
                    categoria="400001,400001";
                    break;	
            case "400025": // DIMAR
                    categoria="400175,400176,400175";
                    break;	
            case "400028": // Coljuegos
                    categoria="400001,400101,400001";
                    break;	
            case "400022": // CGR
                    categoria="400051,400165,400166,400167,400053,400168,400169,400170,400174,400052,400051";
                    break;
            case "400003": // Catastro
                    categoria="400001,400002,400101,400160,400163,400001";
                    break;	
            case "400076": // ARN
                    categoria="400359,400359";
                    break;
            case "400004": // Acueducto
                    categoria="400001,400002,400101,400160,400163,400001";
                    break;		
                default:
                    categoria="5100,5101,5102,5103,5109,400001,400002,400051,400052,400053,400101,400158,400160,400161,400162,400163,400165,400166,400167,400168,400169,400170,400171,400172,400173,400174,400175,400176,400258,400308,400359,400360,400408,400409,400410,400411,5100";
                    break;
    };
    console.log(categoria);
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPCAT', {categoria });
        //console.log('Datos enviados correctamente:', response.data);
        let nombre = ctx.session.userData.first_name;
        let resultList = [];
        let listaG2 = response.data;
                 // Convertir entidades HTML a caracteres normales
        listaG2 = listaG2.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');

         // Expresiones regulares para extraer los valores de 'id' y 'sym'
         let idRegex = /<AttrName>id<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let symRegex = /<AttrName>ss_sym<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let ids = extractValues(idRegex, listaG2);
         let syms = extractValues(symRegex, listaG2);
         // Crear una lista con los valores
         for (let i = 0; i < ids.length; i++) {
            resultList.push({
                item: i + 1,
                id: ids[i],
                sym: syms[i] || '' // En caso de que no haya un valor correspondiente de 'sym'
            });
        };
        console.log(resultList);
        ctx.session.resultList = resultList;
        ctx.scene.enter('listaScene');
    }
    catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('menuScene'); // Salir de la escena después de crear caso;
    };

});

//Escena del listado de categorías
const listaScene = new BaseScene('listaScene');
listaScene.enter(async (ctx) =>{
    let nombre = ctx.session.userData.first_name;
    let rtaUserID = JSON.parse(JSON.stringify(ctx.session.resultList));
    let message = nombre + ', por favor escribe el número del ítem que corresponde a la solución  para la cual se creará el caso: \n';
    for(let i=0; i < rtaUserID.length; i++) {

        const decodedSym = decodeHtmlEntities(rtaUserID[i].sym);
        message += rtaUserID[i].item + '. ' + decodedSym + '\n';
    };
    await ctx.reply(message);

});
listaScene.on('text', (ctx) => {
    let lista = JSON.parse(JSON.stringify(ctx.session.resultList));
    const eleccion = ctx.message.text;
    let encontrado = false;
    for (let i = 0; i < lista.length; i++){
        if(lista[i].item == eleccion ){ 
            encontrado = true;
            let decodedSym = decodeHtmlEntities(lista[i].sym);
            ctx.session.solucion = decodedSym;
            let pcat = lista[i].id;
            ctx.session.pcat = pcat;
            ctx.scene.enter('flowCreationScene');
        };
    };
    if(!encontrado){
        ctx.reply('Por favor, elige una opción válida.');
        ctx.scene.enter('listaScene'); 
    };
});

// Escena para crear un caso
const flowCreationScene = new BaseScene('flowCreationScene');
flowCreationScene.enter((ctx) => {
    ctx.session.flowState = 'askingEvent';
    ctx.reply('¿Cuál es el evento que quiere reportar?');
});
flowCreationScene.on('text', async (ctx) => {
    if (ctx.session.flowState === 'askingEvent') {
        const descripcion = ctx.message.text;
        const asunto = descripcion.length > MAX_SUBJECT_LENGTH ?
            descripcion.substring(0, MAX_SUBJECT_LENGTH) + '...' : descripcion;
        ctx.session.descripcion = descripcion;
        ctx.session.asunto = asunto;
        ctx.session.flowState = 'confirmingInformation';
        const nombre = ctx.session.userData.first_name;
        const solucion = ctx.session.solucion;
        await ctx.replyWithMarkdownV2(
            `${nombre}, ya tengo todos los datos necesarios para la creación del caso: \n *Asunto:* ${asunto} \n *Solución:* ${solucion} \n *Descripción:* ${descripcion} \n\n ¿Es correcta la información suministrada? \\(Sí/No\\)`
        );
    } else if (ctx.session.flowState === 'confirmingInformation') {
        const decision = ctx.message.text;
        if (['Sí', 'sí', 'Si', 'SI', 'si', 'SÍ'].includes(decision)) {
            await ctx.reply('Procesando solicitud...');
            ctx.scene.enter('consumoScene');
        } else if (['No', 'NO', 'no'].includes(decision)) {
            ctx.session.flowState = 'askingEvent';
            await ctx.reply('Comprendo. Volviendo al menú principal..');
            ctx.scene.enter('volverScene');
        } else {
            await ctx.reply('Por favor, ingresa una opción válida');
            ctx.scene.reenter();
        }
    }
});

const volverScene = new BaseScene('volverScene');
volverScene.enter((ctx) =>{
    ctx.reply('Comprendo. ¿Desea volver a ingresar la información (Sí), o cancelar la solicitud de creación? (No)');
});
volverScene.on('text', async (ctx) =>{
    let decision = ctx.message.text;
    if(['Sí','sí','SI','si','SÍ'].includes(decision)){
        await ctx.reply('Volviendo a la lista de soluciones');
        ctx.scene.enter('listaScene');
    }else if(['No','no','NO'].includes(decision)){
        await ctx.reply('Solicitud cancelada. Volviendo al menú principal...');
        ctx.scene.enter('menuScene');
    }else{
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    }
});

const consumoScene = new BaseScene('consumoScene');
consumoScene.enter(async (ctx) =>{
    const msgTicket= {
        cnt: ctx.session.userData.ID,
        categoria: ctx.session.pcat,
        asunto: ctx.session.asunto,
        descripcion: ctx.session.descripcion
    };
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPTickets', msgTicket);
        console.log('Datos enviados correctamente:', response.data);
        const codTicket = JSON.parse(JSON.stringify(response.data));
        ctx.session.codTicket = codTicket;
    }catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('menuScene'); // Salir de la escena después de crear caso;   
    };
    ctx.scene.enter('finalScene');
});

const finalScene = new BaseScene('finalScene');
finalScene.enter( (ctx) =>{
    const codTicket=ctx.session.codTicket;
    ctx.reply('El caso con número de referencia '+ codTicket + ' fue creado con éxito! \n\n¿Desea realizar alguna solicitud adicional? (Sí/No)');
});
finalScene.on('text',async (ctx)=>{
    const decision = ctx.message.text;
    if(['Sí','sí','SI','si','SÍ'].includes(decision)){
        await ctx.reply('Entendido! Volviendo al menú principal');
        ctx.scene.enter('menuScene');
    }else if(['No','no','NO'].includes(decision)){
        await ctx.reply('Terminando la solicitud. Gracias por usar nuestros servicios!');
        ctx.session= {};
        ctx.scene.leave();
    }else{
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    }
});

const consultarCasosScene = new BaseScene('consultarCasosScene');
consultarCasosScene.enter(async (ctx) => {
    let itemsConsulta = [];
    const UserID = ctx.session.UserID;
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPConsulta', { UserID });
        console.log('Datos enviados correctamente:', response.data);
        const listaG = response.data;
         // Convertir entidades HTML a caracteres normales
         listaConsulta = listaG.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
         console.log('lista:' + listaConsulta);

         // Expresiones regulares para extraer los valores de 'id' y 'sym'
         let refNumRegex = /<AttrName>ref_num<\/AttrName>\s*<AttrValue>(.*?)<\/AttrValue>/g;
         let refNum = extractValues(refNumRegex, listaConsulta);
         console.log('ref:' + refNum);
          
         // Crear una lista con los valores
         for (let i = 0; i < refNum.length; i++) {
            itemsConsulta.push({
                item: i + 1,
                id: refNum[i]
            });
        };
        console.log('estado:'+ JSON.stringify(itemsConsulta));
        ctx.session.itemsConsulta = itemsConsulta;
         if(itemsConsulta != ''){
            ctx.scene.enter('flowCasoScene');
         }
         else{
            await ctx.reply('No se encontraron casos relacionados a la cuenta. Volviendo al menú.');
            ctx.scene.enter('menuScene'); // Salir de la escena después de crear caso;
         };
    } catch (error) {
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('menuScene'); // Salir de la escena después de crear caso;
    }
});

const flowCasoScene = new BaseScene('flowCasoScene');
flowCasoScene.enter((ctx) =>{
    let rtaCasosUser = ctx.session.itemsConsulta;
    let nombre = ctx.session.userData.first_name;
    let message = '';
    
    for(let i=0; i < rtaCasosUser.length; i++) {

            message += rtaCasosUser[i].item + '. ' + rtaCasosUser[i].id + '\n';
    };

    ctx.reply(nombre+ ', estos son los casos activos actualmente: \n' + message + '\n Escribe el número del ítem del caso el cual desea saber más detalles.');
});
flowCasoScene.on('text', async (ctx) =>{
    let eleccion = parseInt(ctx.message.text);
    let encontrado = false;
    let lista = ctx.session.itemsConsulta;
    for (let i = 0; i < lista.length; i++){
        if(lista[i].item == eleccion ){ 
            encontrado = true;
            let caso = lista[i].id;
            ctx.session.caso = caso;
            ctx.scene.enter('detalleCasoScene');
        };
    };
    if(!encontrado){
        await ctx.reply('Por favor, ingresa una opción válida');
        ctx.scene.reenter();
    };
});

const detalleCasoScene = new BaseScene('detalleCasoScene');
detalleCasoScene.enter(async (ctx) =>{
    let ref_num = ctx.session.caso;
    try{
        const response = await axios.post('http://192.168.10.83:8080/WPConsultaDetalle', { ref_num });
        console.log('Datos enviados correctamente:', response.data);
        ctx.session.contenido = response.data;
        ctx.scene.enter('postDetalleScene');
    }catch{
        await ctx.reply('Hubo un error en la consulta. Por favor, inténtalo de nuevo.');
        ctx.scene.enter('menuScene'); // Salir de la escena después de crear caso;
    };
});

const postDetalleScene = new BaseScene('postDetalleScene');
postDetalleScene.enter((ctx) =>{
    let nombre = ctx.session.userData.first_name;
    const contenido = ctx.session.contenido;
    console.log('ref_num:'+ contenido.ref_num);
    let message= ' Numero de referencia: ' + contenido.ref_num + '\n Descripción: ' + contenido.summary + '\n Estado: '+ contenido.status + '\n Solución: '+ contenido.cat;
    ctx.reply(nombre + ', estos son los detalles del caso seleccionado: \n \n'+ message + '\n \n¿Desea realizar alguna otra solicitud? (Sí/No)');
});
postDetalleScene.on('text', async (ctx) =>{
    let decision = ctx.message.text;
    if(['si','Sí','SI','Si','SÍ','Yes','yes'].includes(decision)){
        await ctx.reply('Entendido! Volviendo al menú principal');
        ctx.scene.enter('menuScene');
    }
    else if (['No','no','NO'].includes(decision)) {
        await ctx.reply('Terminando la solicitud. Gracias por usar nuestros servicios!');
        ctx.session= {};
        ctx.scene.leave()
    } else {
        await ctx.reply('Por favor, ingresa una opción válida')
        ctx.scene.reenter();
    };
});



bot.use(session());

// Middleware para manejar el comando /salir globalmente
bot.use((ctx, next) => {
    if (ctx.message && ctx.message.text && ctx.message.text.toLowerCase() === '/salir') {
        ctx.reply('Has salido de la sesión. Para iniciar una nueva sesión, utiliza /start.');
        ctx.session = {}; // Limpiar la sesión del usuario
        if (ctx.scene && ctx.scene.leave) {
            ctx.scene.leave(); // Salir de la escena actual, si existe
        }
    } else {
        return next(); // Continuar con la siguiente middleware
    }
});

const stage = new Stage([usernameScene, menuScene, consultarCasosScene, crearCasoScene, listaScene, flowCreationScene,volverScene,finalScene,consumoScene,flowCasoScene,detalleCasoScene,postDetalleScene,analistaFlujoScene,consultarCasosAnalistaScene,opcionesCasoScene,detalleCasoAnalistaScene,postDetalleAnalistaScene, agregarComentarioAnalistaScene, comentandoScene, postComentarioAnalistaScene, listaEstadoAnalistaScene, cambioEstadoScene, postCambioEstadoScene])
bot.use(stage.middleware());

// Comando /start para reiniciar la sesión
bot.command('start', (ctx) => {
    ctx.session = {}; // Limpiar la sesión del usuario
    ctx.scene.enter('usernameScene'); // Entrar en la escena inicial
});

// Comando /salir para salir de la sesión
bot.command('salir', (ctx) => {
    ctx.reply('Has salido de la sesión. Para iniciar una nueva sesión, utiliza /start.');
    ctx.session = {}; // Limpiar la sesión del usuario
    if (ctx.scene && ctx.scene.leave) {
        ctx.scene.leave(); // Salir de la escena actual, si existe
    }
});

// Función para normalizar y converxtir a minúsculas 
function normalizeString(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
};

// Función para extraer valores usando una expresión regular
function extractValues(regex, str) {
    let values = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
        values.push(match[1]);
    }
    return values;
};

function decodeHtmlEntities(text) {
    const entities = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&#xF3;': 'ó',
        '&#xE9;': 'é',
        '&#xE1;': 'á'
        // Puedes agregar más entidades según sea necesario
    };

    return text.replace(/&[a-zA-Z0-9#x]+;/g, (match) => {
        return entities[match] || match;
    });
};

// Función para normalizar caracteres especiales
function normalizeString(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
};


// Manejador de cualquier texto para iniciar el flujo de conversación
bot.on('text', (ctx) => {
    if (!ctx.session.userData) {  // Si no hay datos de usuario, iniciar el flujo de login
        ctx.scene.enter('usernameScene');
    } else if (!ctx.session.flowState) {  // Si no hay flujo en curso, iniciar desde el menú
        ctx.scene.enter('menuScene');
    } else {
        ctx.reply('Estoy en medio de una operación. Por favor, completa la operación o cancela para iniciar una nueva.');
    }
});

bot.launch();   