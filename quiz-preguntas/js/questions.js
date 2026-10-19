/**
 * Datos del cuestionario: 20 preguntas, 4 respuestas cada una.
 * Marca exactamente una respuesta con correct: true y las otras tres con correct: false.
 * Puedes reordenar las respuestas; en pantalla se mezclan al azar.
 *
 * Opcional: "video" — ruta relativa al index.html (ej. "vids/1.mp4"), URL directa a vídeo o
 * enlace de YouTube (watch o youtu.be).
 */
window.QUIZ_QUESTIONS = [
  {
    text: "",
    video: "vids/1.mp4",
    answers: [
      { text: "Respuesta correcta de ejemplo", correct: false },
      { text: "Opción incorrecta A", correct: false },
      { text: "Opción incorrecta B", correct: false },
      { text: "Opción incorrecta C", correct: true },
    ],
  },
  {
    text: "",
    video: "vids/2.mp4",
    answers: [
      { text: "Incorrecta", correct: false },
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/3.mp4",
    answers: [
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/4.mp4",
    answers: [
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/5.mp4",
    answers: [
      { text: "Incorrecta", correct: false },
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/6.mp4",
    answers: [
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Correcta de ejemplo", correct: true },
    ],
  },
  {
    text: "",
    video: "vids/7.mp4",
    answers: [
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/8.mp4",
    answers: [
      { text: "Incorrecta", correct: false },
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/9.mp4",
    answers: [
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
    ],
  },
  {
    text: "",
    video: "vids/10.mp4",
    answers: [
      { text: "Correcta de ejemplo", correct: true },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
      { text: "Incorrecta", correct: false },
    ],
  },
];

/**
 * Ronda Precio: 10 preguntas con una cifra objetivo por cada una.
 * Los participantes escriben un número y gana 1 punto quien más se acerque.
 * Vídeo por defecto: vids/p1.mp4, vids/p2.mp4, ... (también .webm con el mismo nombre).
 * Opcional: "video" para forzar una URL o archivo (misma lógica que en QUIZ_QUESTIONS).
 */
window.PRICE_QUESTIONS = [
  { text: "Precio de ejemplo 1 (sustituye por tu dato real).", value: 54.39 },
  { text: "Precio de ejemplo 2.", value: 2695.00 },
  { text: "Precio de ejemplo 3.", value: 7500.00 },
  { text: "Precio de ejemplo 4.", value: 801.00 },
  { text: "Precio de ejemplo 5.", value: 1960.00 },
  { text: "Precio de ejemplo 6.", value: 6.80 },
  { text: "Precio de ejemplo 7.", value: 504.93 },
  { text: "Precio de ejemplo 8.", value: 606.98 },
  { text: "Precio de ejemplo 9.", value: 62831853071750.00 },
  { text: "Precio de ejemplo 10.", value: 1025.00 },
];

/**
 * Ronda Ahorcado: 5 palabras clave.
 * Cada acierto suma 1 punto y cada fallo resta 1 punto.
 * Vídeo por palabra (orden fijo): vids/A1.mp4, vids/A2.mp4, … (también .webm con el mismo nombre).
 */
window.HANGMAN_WORDS = [
  { word: "EL ULTIMO MAGO DEL SIGLO" },
  { word: "BASIL EL RATON SUPERDETECTIVE" },
  { word: "OCHO APELLIDOS VASCOS" },
  { word: "BEN HUR" },
  { word: "NIGHT OF THE DAY OF THE DAWN OF THE SON OF THE BRIDE OF THE RETURN OF THE REVENGE OF THE TERROR OF THE ATTACK OF THE EVIL MUTANT HELLBOUND FLESHING SUBHUMANOID ZOMBIFIED LIVING DEAD PART TWO TWO IN SHOCKING 2D" },
];

/**
 * Ronda Eleccion: pregunta de respuesta libre + votos del resto.
 * - El jugador que responde suma +3 si acierta.
 * - Si acierta, cada jugador en "A favor" suma +1.
 * - Si falla, cada jugador en "En contra" suma +1.
 *
 * Puedes usar "answers" con varias respuestas validas.
 */
window.ELECTION_QUESTIONS = [
  { text: "En el ajedrez, ¿en que casilla empieza la dama del primer jugador?", answers: ["blanca"] },
  { text: "¿El Raichu de Alola tiene un color mas oscuro o claro que el original?.", answers: ["oscuro"] },
  { text: "¿Quien invento la primera lavadora electrica era hombre o mujer?", answers: ["hombre"] },
  { text: "¿Sin contar la consola Switch de Nintendo, cual ha sido su consola mas vendida, una portatil o una de sobremesa?", answers: ["portatil"] },
  { text: "¿Quien invento la World Wide Web (el internet de hoy en dia), Inglaterra o Alemania?", answers: ["inglaterra"] },
  { text: "¿En que año fue el primer Eurovision, 1954 o 1956?", answers: ["1956"] },
  { text: "¿Cuantas comunidades autónomas hay en España, par o impar?", answers: ["impar"] },
  { text: "¿Cuantas barras inclinadas tiene el logo de Adidas, tres o cuatro?", answers: ["tres"] },
  { text: "Cuantas veces a ganado Eurovision España, una cantidad par o impar", answers: ["par"] },
  { text: "Cuantos dedos tienen los personajes de los Simpsons en los pies, cuatro o cinco?", answers: ["cuatro"] },
  { text: "¿El manga de Dragon Ball Z tiene mas o menos de 500 capitulos?", answers: ["mas"] },
  { text: "Hay mas o menos de 120 elementos en la tabla periodica", answers: ["menos"] },
];

/**
 * Ronda Rosco (Pasapalabra): turnos entre todos los jugadores.
 * - Primera vuelta: 30 s por respuesta; desde la segunda vuelta: 15 s y pista extra (hint). Empieza quien tenga menos puntos.
 * - Acierto: +1 por letra; fallo o tiempo agotado: -1.
 * - Pasapalabra: pasa letra y turno sin quitar punto; fallo o tiempo agotado: -1 y letra fallada (amarillo).
 */
window.ROSCO_LETTERS = [
  {
    letter: "A",
    clue: "Duerme 18 horas al día. Incluso en pleno sueño, usa sus poderes para huir",
    hint: "Tipo Psíquico. Puede teletransportarse.",
    answers: ["abra"],
  },
  {
    letter: "B",
    clue: "Un valiente guerrero del cielo que no duda en luchar por sus compañeros por graves que sean sus heridas.",
    hint: "Tipo Normal/Volador. Ave de Unova.",
    answers: ["braviary"],
  },
  {
    letter: "C",
    clue: "Su adorable grito y comportamiento lo hacen muy popular. Sin embargo, raramente se avista.",
    hint: "Tipo Hada. Relacionado con la luna.",
    answers: ["clefairy"],
  },
  {
    letter: "D",
    clue: "Es de naturaleza mansa y amable, pero, si se lo provoca y monta en cólera, destruye todo lo que lo rodea con su aliento devastador.",
    hint: "Tipo Normal/Dragón. Pokémon anciano.",
    answers: ["drampa"],
  },
  {
    letter: "E",
    clue: "Todavía no se ha esclarecido el motivo por el que es el único Pokémon que presenta un código genético inestable.",
    hint: "Tipo Normal. Puede evolucionar a muchas formas distintas.",
    answers: ["eevee"],
  },
  {
    letter: "F",
    clue: "Gracias a su agilidad y a la flexibilidad de su cuerpo, es capaz de escabullirse con facilidad cuando alguien lo agarra.",
    hint: "Tipo Normal. Tiene un meme.",
    answers: ["furret"],
  },
  {
    letter: "G",
    clue: "Su estómago es capaz de digerir cualquier cosa. Al hacerlo, produce gases de una pestilencia nauseabunda.",
    hint: "Tipo Veneno. Puede tragarse cosas enormes.",
    answers: ["gulpin"],
  },
  {
    letter: "H",
    clue: "Se deja llevar por el viento, por lo que se hallan ejemplares repartidos prácticamente por todo el mundo, salvo en las regiones más frías.",
    hint: "Tipo Planta/Volador. Siempre aparece feliz.",
    answers: ["hoppip"],
  },
  {
    letter: "I",
    clue: "Cuando se aviva su espíritu combativo, las llamas que le rodean la cintura también arden de forma especialmente intensa.",
    hint: "Tipo Fuego/Siniestro. Sale en ciertos juegos de lucha",
    answers: ["incineroar"],
  },
  {
    letter: "J",
    clue: "Sus gritos se parecen al lenguaje humano, pero es imposible entender lo que dice.",
    hint: "Tipo Hielo/Psíquico. Sale en la primera generación de pokemon.",
    answers: ["jynx"],
  },
  {
    letter: "K",
    clue: "Se dice que recarga energía durmiendo en los rincones más profundos del océano, allí donde ningún otro ser puede llegar.",
    hint: "Tipo Agua/Dragón. Evolcuiona por intercambio con escama dragon",
    answers: ["kingdra"],
  },
  {
    letter: "L",
    clue: "De porte majestuoso, puede sentir presencias a gran distancia con las ondas que emite y controla a voluntad.",
    hint: "Tipo Lucha/Acero. Lee el aura.",
    answers: ["lucario"],
  },
  {
    letter: "M",
    clue: "Se cuenta que alguna vez ha iluminado el camino con sus alas flamígeras para rescatar a alguien que se había perdido en la montaña.",
    hint: "Tipo Fuego/Volador. Pokemon legendario",
    answers: ["moltres"],
  },
  {
    letter: "N",
    clue: "Su plumaje es extraordinariamente suave y no emite el menor sonido cuando vuela, lo que le permite acercarse a su presa sin ser detectado.",
    hint: "Tipo Normal/Volador. Ve bien de noche",
    answers: ["noctowl"],
  },
  {
    letter: "O",
    clue: "Se alimenta sin cesar a medida que se abre paso bajo tierra retorciendo su robusto y largo cuerpo.",
    hint: "Tipo Roca/Tierra. Serpiente de piedra.",
    answers: ["onix"],
  },
  {
    letter: "P",
    clue: "Seguir el ritmo de sus progenitores le sirve para fortalecer las patas. Galopa el día entero por el campo y la montaña.",
    hint: "Tipo Fuego. Es la fase inicial",
    answers: ["ponyta"],
  },
  {
    letter: "Q",
    clue: "Este Pokémon de carácter tranquilo nada despreocupado y siempre termina chocando de cabeza contra el casco de los barcos.",
    hint: "Tipo Agua/Tierra. Tiene una evolucion paralela en Paldea",
    answers: ["quagsire"],
  },
  {
    letter: "R",
    clue: "Si sus cuernos rojizos perciben emociones positivas de personas o Pokémon, su cuerpo se calienta un poco.",
    hint: "Tipo Psíquico/Hada. Su ultima evolucion cambia dependiendo del genero",
    answers: ["ralts"],
  },
  {
    letter: "S",
    clue: "Su órgano central, conocido como núcleo, brilla con los colores del arcoíris cuando se dispone a liberar sus potentes poderes psíquicos.",
    hint: "Tipo Agua/Psíquico. Megaevolucion muy aclamada",
    answers: ["starmie"],
  },
  {
    letter: "T",
    clue: "Cuando elige una presa, embiste sin pensárselo. Este Pokémon es famoso por su carácter violento.",
    hint: "Tipo Normal. Manada de bovinos agresivos.",
    answers: ["tauros"],
  },
  {
    letter: "U",
    clue: "Si se expone al aura de la luna, los anillos de su cuerpo relucen y adquiere un poder misterioso.",
    hint: "Tipo Siniestro. Una de muchas evoluciones posibles",
    answers: ["umbreon"],
  },
  {
    letter: "V",
    clue: "Se mueve rodando. Si el terreno es irregular, una chispa provocada por algún bache lo hará explotar.",
    hint: "Tipo Eléctrico. Parecido a una pelota.",
    answers: ["voltorb"],
  },
  {
    letter: "W",
    clue: "En días soleados juega en la playa botando como una pelota. Lanza agua por sus espiráculos.",
    hint: "Tipo Agua. Evoluciona al pokemon mas grande sin contar legendarios",
    answers: ["wailmer"],
  },
  {
    letter: "X",
    clue: "Este extraño Pokémon puede ver el pasado y el futuro. Pasa los días observando el movimiento del sol.",
    hint: "Tipo Psíquico/Volador. Toques mayas y aztecas",
    answers: ["xatu"],
  },
  {
    letter: "Y",
    clue: "Son muy glotones, por lo que ayudan a la gente a cambio de comida. Echan chispas al correr.",
    hint: "Tipo Eléctrico. Perro de Galar.",
    answers: ["yamper"],
  },
  {
    letter: "Z",
    clue: "Duerme en cuevas durante el día. Como no tiene ojos, se guía emitiendo ultrasonidos cuando vuela.",
    hint: "Tipo Veneno/Volador. Vive en cuevas.",
    answers: ["zubat"],
  },
];
