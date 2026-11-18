"use strict";

// Birthday party: when she drops down from the starting room of level 1 into
// room 2, every guard is there dancing around a birthday cake and singing
// "Tanti auguri", and the dogs run over to greet her.
// The name can be changed with ?name=... in the URL (read once at page load,
// since the game rewrites the query string afterwards).

PrinceJS.Party = function (game, state) {
  this.game = game;
  this.state = state;
  this.level = state.level;
  this.room = PrinceJS.Party.ROOM;

  let roomData = this.level.rooms[this.room];
  this.baseX = roomData.x * PrinceJS.ROOM_WIDTH;
  this.baseY = roomData.y * PrinceJS.ROOM_HEIGHT + 3;
  this.floorY = this.baseY + PrinceJS.Utils.convertBlockYtoY(PrinceJS.Party.FLOOR_ROW) + 1;
  this.anims = this.game.cache.getJSON("fighter-anims");

  this.inviteGuards();
  this.createCake();
  this.createDancers();
  this.createDogs();
  this.createLights();
  this.createConfetti();
  this.createLyrics();
  this.game.world.sort("z");

  this.audio = null;
  this.playing = false;
  this.startTime = 0;
  this.lastLine = null;
  this.lastTime = this.game.time.now;
};

PrinceJS.Party.ROOM = 2;
PrinceJS.Party.LEVEL = 1;
PrinceJS.Party.FLOOR_ROW = 1;
PrinceJS.Party.BPM = 132;

PrinceJS.Party.NAME = (function () {
  try {
    let name = new URLSearchParams(window.location.search).get("name");
    return name ? name.trim().slice(0, 14) : "cuginap";
  } catch (e) {
    return "cuginap";
  }
})();

// [character key, x position of the dancer's center inside the room, facing (-1 left, 1 right)]
PrinceJS.Party.GUESTS = [
  ["guard-2", 16, 1],
  ["skeleton", 44, 1],
  ["guard-4", 72, 1],
  ["fatguard", 102, 1],
  ["guard-5", 128, 1],
  ["guard-7", 280, -1],
  ["guard-3", 306, -1]
];

PrinceJS.Party.CAKE_X = 164;

// Dance moves: fighter animation frames (engarde, arms-up block, advance steps)
PrinceJS.Party.MOVES = [
  [8, 19, 20, 21],
  [13, 14, 15, 19],
  [20, 21, 19, 16]
];

// Happy Birthday / Tanti auguri (public domain melody) in C, 3/4 time.
// Each note: [midi, beats, lyric line index starting at this note]
PrinceJS.Party.MELODY = [
  [67, 0.75, 0], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2],
  [67, 0.75, 1], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
  [67, 0.75, 2], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
  [77, 0.75, 3], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 3]
];

// One chord per 3/4 bar, starting after the 1-beat pickup: [bass, chord tones...]
PrinceJS.Party.CHORDS = [
  [48, 60, 64, 67], // C
  [43, 59, 62, 65], // G7
  [43, 59, 62, 65], // G7
  [48, 60, 64, 67], // C
  [48, 58, 64, 67], // C7
  [41, 60, 65, 69], // F
  [43, 59, 62, 67], // G
  [48, 60, 64, 67] // C
];

// --- Pixel art (one character per pixel, "." is transparent) ---

PrinceJS.Party.CAKE = [
  "...c......c......c....",
  "...c......c......c....",
  "...c......c......c....",
  "..WWWWWWWWWWWWWWWWWW..",
  ".WWRWWWWWWRWWWWWWRWWW.",
  ".PPPPPPPPPPPPPPPPPPPP.",
  ".PWPPWPPPWPPWPPPWPPWP.",
  ".CCCCCCCCCCCCCCCCCCCC.",
  ".CCCCCCCCCCCCCCCCCCCC.",
  ".WWWWWWWWWWWWWWWWWWWW.",
  ".CCCCCCCCCCCCCCCCCCCC.",
  ".CCCCCCCCCCCCCCCCCCCC.",
  "GGGGGGGGGGGGGGGGGGGGGG",
  "..TTTTTTTTTTTTTTTTTT..",
  "..tTTTTTTTTTTTTTTTTt..",
  "...t..............t...",
  "...t..............t...",
  "...t..............t...",
  "...t..............t...",
  "...t..............t...",
  "...t..............t...",
  "..tt..............tt.."
];

PrinceJS.Party.CAKE_COLORS = {
  c: "#ff6ab4",
  W: "#fff8ee",
  R: "#e0182c",
  P: "#ff9ccc",
  C: "#7a4224",
  G: "#c8ccd8",
  T: "#a8743c",
  t: "#6e4622"
};

// Candle flames, two frames, drawn above the candles
PrinceJS.Party.FLAMES = [
  ["...y......Y......y....", "..yOy....yOy....yOy...", "...o......o......o...."],
  ["...Y......y......Y....", "...Oy....yO......Oy...", "...o......o......o...."]
];

PrinceJS.Party.FLAME_COLORS = { y: "#ffe860", Y: "#fff8c0", O: "#ff9a20", o: "#ff6010" };

// Dog facing right; two tail positions to wag
PrinceJS.Party.DOG = [
  [
    "..............dd..",
    "..o..........dood.",
    "..o..........ookoo",
    "...o.........oooon",
    "...o........ooopp.",
    "...oooooooooooo...",
    "...oooooooooooo...",
    "...ooLLLLLLLooo...",
    "...oo.oo...oo.oo..",
    "...oo.oo...oo.oo..",
    "...dd.dd...dd.dd.."
  ],
  [
    "..............dd..",
    "o............dood.",
    ".o...........ookoo",
    "..o..........oooon",
    "...o........ooopp.",
    "...oooooooooooo...",
    "...oooooooooooo...",
    "...ooLLLLLLLooo...",
    "...oo.oo...oo.oo..",
    "...oo.oo...oo.oo..",
    "...dd.dd...dd.dd.."
  ]
];

// [fur, darker fur (ears, paws), belly, offset from her: negative = left of her]
PrinceJS.Party.DOGS = [
  ["#d8a050", "#9a6424", "#f0d098", -26],
  ["#3a3236", "#1c181c", "#e8e0d8", 26],
  ["#f4f0e8", "#a8743c", "#ffffff", -46]
];

PrinceJS.Party.prototype = {
  bannerText: function () {
    return "Buon compleanno " + PrinceJS.Party.NAME + "!";
  },

  lyricLines: function () {
    let name = PrinceJS.Party.NAME;
    return ["Tanti auguri a te!", "Tanti auguri a te!", "Tanti auguri " + name + "!", "Tanti auguri a te!"];
  },

  pixelArt: function (rows, colors) {
    let width = Math.max(...rows.map((row) => row.length));
    let bmd = this.game.make.bitmapData(width, rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        let color = colors[row[x]];
        if (color) {
          bmd.rect(x, y, 1, 1, color);
        }
      }
    });
    return bmd;
  },

  inviteGuards: function () {
    // Everyone is off duty tonight: hide the level's guards so nobody wants to fight.
    let enemies = this.state.enemies;
    for (let i = enemies.length - 1; i >= 0; i--) {
      let enemy = enemies[i];
      if (enemy.baseCharName !== "guard") {
        continue;
      }
      enemy.setInvisible();
      enemy.setInactive();
      if (this.state.kid.opponent === enemy) {
        this.state.kid.opponent = null;
      }
      enemies.splice(i, 1);
    }
  },

  createCake: function () {
    let x = this.baseX + PrinceJS.Party.CAKE_X;
    this.cake = this.game.add.image(x, this.floorY, this.pixelArt(PrinceJS.Party.CAKE, PrinceJS.Party.CAKE_COLORS));
    this.cake.anchor.setTo(0.5, 1);
    this.cake.z = 19;

    this.flameTextures = PrinceJS.Party.FLAMES.map((rows) => this.pixelArt(rows, PrinceJS.Party.FLAME_COLORS));
    this.flames = this.game.add.image(x, this.cake.y - this.cake.height, this.flameTextures[0]);
    this.flames.anchor.setTo(0.5, 1);
    this.flames.z = 19;
  },

  createDancers: function () {
    this.dancers = [];
    PrinceJS.Party.GUESTS.forEach((guest, index) => {
      let sprite = this.game.add.sprite(0, 0, guest[0]);
      sprite.anchor.setTo(0.5, 1);
      sprite.z = 20;
      let dancer = {
        sprite: sprite,
        key: guest[0],
        x: this.baseX + guest[1],
        baseFace: guest[2],
        face: guest[2],
        moves: PrinceJS.Party.MOVES[index % PrinceJS.Party.MOVES.length],
        phase: index % 2
      };
      this.dancers.push(dancer);
      this.poseDancer(dancer, 16, 0);
    });
  },

  poseDancer: function (dancer, frame, hop) {
    let framedef = this.anims.framedef[frame] || { fdy: 0 };
    let sprite = dancer.sprite;
    sprite.frameName = dancer.key + "-" + frame;
    // Sprites are drawn facing left; centered anchor keeps them in place when they turn
    sprite.scale.x = -dancer.face;
    sprite.x = dancer.x;
    sprite.y = this.floorY - 1 + framedef.fdy - hop;
  },

  createDogs: function () {
    this.dogs = PrinceJS.Party.DOGS.map((def, index) => {
      let colors = { o: def[0], d: def[1], L: def[2], k: "#101010", n: "#101010", p: "#ff7090" };
      let textures = PrinceJS.Party.DOG.map((rows) => this.pixelArt(rows, colors));
      let sprite = this.game.add.image(0, this.floorY, textures[0]);
      sprite.anchor.setTo(0.5, 1);
      sprite.z = 22;
      // Dogs wait near the cake until she arrives
      let x = this.baseX + PrinceJS.Party.CAKE_X + 22 + index * 18;
      sprite.x = x;
      return {
        sprite: sprite,
        textures: textures,
        x: x,
        offset: def[3],
        speed: 70 + index * 12,
        face: 1,
        greeted: false,
        nextBark: 0,
        hopPhase: index * 1.7
      };
    });
  },

  createLights: function () {
    let room = this.level.rooms[this.room];
    let bmd = this.game.make.bitmapData(PrinceJS.ROOM_WIDTH, PrinceJS.ROOM_HEIGHT);
    bmd.fill(255, 255, 255, 1);
    this.lights = this.game.add.image(room.x * PrinceJS.ROOM_WIDTH, room.y * PrinceJS.ROOM_HEIGHT, bmd);
    this.lights.alpha = 0;
    this.lights.z = 35;
    this.lightColors = [0xff3070, 0x30c0ff, 0xffe030, 0x60ff60, 0xc060ff];
  },

  createConfetti: function () {
    let colors = ["#ff3070", "#30c0ff", "#ffe030", "#60ff60", "#c060ff", "#ffffff"];
    let textures = colors.map((color) => {
      let bmd = this.game.make.bitmapData(2, 3);
      bmd.rect(0, 0, 2, 3, color);
      return bmd;
    });
    let room = this.level.rooms[this.room];
    this.confetti = this.game.add.emitter(
      room.x * PrinceJS.ROOM_WIDTH + PrinceJS.ROOM_WIDTH / 2,
      room.y * PrinceJS.ROOM_HEIGHT + 2,
      160
    );
    this.confetti.width = PrinceJS.ROOM_WIDTH;
    this.confetti.makeParticles(textures);
    this.confetti.gravity = 40;
    this.confetti.setXSpeed(-25, 25);
    this.confetti.setYSpeed(10, 50);
    this.confetti.setRotation(-200, 200);
    this.confetti.z = 40;
  },

  createLyrics: function () {
    let room = this.level.rooms[this.room];
    let centerX = room.x * PrinceJS.ROOM_WIDTH + PrinceJS.ROOM_WIDTH / 2;
    let top = room.y * PrinceJS.ROOM_HEIGHT;
    this.banner = this.game.add.bitmapText(centerX, top + 16, "font", "", 16);
    this.banner.anchor.setTo(0.5, 0.5);
    this.banner.z = 41;
    this.lyrics = this.game.add.bitmapText(centerX, top + 36, "font", "", 16);
    this.lyrics.anchor.setTo(0.5, 0.5);
    this.lyrics.z = 41;
  },

  start: function () {
    if (this.playing) {
      return;
    }
    this.playing = true;
    this.lastLine = null;
    this.banner.text = this.bannerText();
    this.confetti.start(false, 4000, 40);
    this.startAudio();
  },

  stop: function () {
    if (!this.playing) {
      return;
    }
    this.playing = false;
    this.confetti.on = false;
    this.lights.alpha = 0;
    this.banner.text = "";
    this.lyrics.text = "";
    this.stopAudio();
  },

  destroy: function () {
    this.stopAudio();
  },

  // Called every frame from Game.update
  update: function () {
    let now = this.game.time.now;
    let dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    let inRoom = this.state.currentCameraRoom === this.room;
    if (inRoom && !this.playing) {
      this.start();
    } else if (!inRoom && this.playing) {
      this.stop();
    }
    if (!this.playing) {
      return;
    }

    let beatLength = 60 / PrinceJS.Party.BPM;
    let beat = (this.now() - this.startTime) / beatLength;
    let loopBeats = this.songBeats() + 3;
    let beatInLoop = ((beat % loopBeats) + loopBeats) % loopBeats;
    let beatIndex = Math.floor(beat);
    let fraction = beat - beatIndex;

    // Dance: switch pose every beat, hop on the downbeat, turn around every two bars
    this.dancers.forEach((dancer) => {
      let step = Math.max(0, beatIndex + dancer.phase);
      let frame = dancer.moves[step % dancer.moves.length];
      let hop = step % 3 === 0 ? Math.round(Math.sin(fraction * Math.PI) * 5) : 0;
      dancer.face = Math.floor(step / 6) % 2 === 0 ? dancer.baseFace : -dancer.baseFace;
      this.poseDancer(dancer, frame, hop);
    });

    // Candles flicker
    this.flames.loadTexture(this.flameTextures[Math.floor(now / 140) % 2]);

    this.updateDogs(dt, now);

    // Disco lights pulse on each beat
    this.lights.tint = this.lightColors[Math.max(0, beatIndex) % this.lightColors.length];
    this.lights.alpha = 0.16 * (1 - fraction);
    this.banner.tint = this.lightColors[(Math.max(0, beatIndex) + 2) % this.lightColors.length];

    // Lyrics follow the melody
    let line = this.lineAt(beatInLoop);
    if (line !== this.lastLine) {
      this.lastLine = line;
      this.lyrics.text = line >= 0 ? this.lyricLines()[line] : "Sorpresa!";
    }
  },

  updateDogs: function (dt, now) {
    let kid = this.state.kid;
    let kidHere = kid.room === this.room && kid.charBlockY === PrinceJS.Party.FLOOR_ROW;
    let kidX = kid.x + kid.width / 2;
    let minX = this.baseX + 8;
    let maxX = this.baseX + PrinceJS.ROOM_WIDTH - 8;

    this.dogs.forEach((dog, index) => {
      let target = kidHere ? kidX + dog.offset : dog.x;
      target = Math.max(minX, Math.min(maxX, target));
      let distance = target - dog.x;
      let running = Math.abs(distance) > 2;
      if (running) {
        dog.x += Math.sign(distance) * Math.min(Math.abs(distance), dog.speed * dt);
        dog.face = Math.sign(distance);
      } else if (kidHere) {
        dog.face = kidX >= dog.x ? 1 : -1;
      }

      let near = kidHere && Math.abs(kidX - dog.x) < Math.abs(dog.offset) + 8;
      if (near && !dog.greeted) {
        dog.greeted = true;
        dog.nextBark = now + 300 + index * 250;
      }
      if (near && now >= dog.nextBark) {
        this.bark(index);
        dog.nextBark = now + 2500 + Math.random() * 3500;
      }

      // Happy hops when next to her, small trot bounce while running
      let t = now / 1000 + dog.hopPhase;
      let hop = near ? Math.max(0, Math.sin(t * 9)) * 6 : running ? Math.abs(Math.sin(t * 18)) * 2 : 0;
      dog.sprite.loadTexture(dog.textures[Math.floor(now / (near ? 90 : 180)) % 2]);
      dog.sprite.scale.x = dog.face;
      dog.sprite.x = Math.round(dog.x);
      dog.sprite.y = Math.round(this.floorY - hop);
    });
  },

  songBeats: function () {
    return PrinceJS.Party.MELODY.reduce((sum, note) => sum + note[1], 0);
  },

  lineAt: function (beatInLoop) {
    if (beatInLoop >= this.songBeats()) {
      return -1;
    }
    let t = 0;
    let line = -1;
    for (let i = 0; i < PrinceJS.Party.MELODY.length && t <= beatInLoop; i++) {
      let note = PrinceJS.Party.MELODY[i];
      if (note[2] !== undefined) {
        line = note[2];
      }
      t += note[1];
    }
    return line;
  },

  // --- Audio: a little chiptune band synthesized with Web Audio ---

  now: function () {
    return this.audio ? this.audio.ctx.currentTime : this.game.time.now / 1000;
  },

  startAudio: function () {
    let ctx = this.game.sound.context;
    let ownCtx = false;
    if (!ctx) {
      let AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        this.startTime = this.now();
        return;
      }
      ctx = new AudioContextClass();
      ownCtx = true;
    }
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    let master = ctx.createGain();
    master.gain.value = this.game.sound.mute ? 0 : 0.22;
    master.connect(ctx.destination);
    this.audio = { ctx: ctx, master: master, ownCtx: ownCtx, timer: null, nextLoop: 0 };
    this.startTime = ctx.currentTime + 0.1;
    this.audio.nextLoop = this.startTime;
    this.scheduleLoops();
  },

  scheduleLoops: function () {
    // Schedule song loops a little ahead of time so playback never gaps
    let audio = this.audio;
    if (!audio) {
      return;
    }
    let beatLength = 60 / PrinceJS.Party.BPM;
    let loopLength = (this.songBeats() + 3) * beatLength;
    while (audio.nextLoop < audio.ctx.currentTime + loopLength) {
      this.scheduleSong(audio.nextLoop, beatLength);
      audio.nextLoop += loopLength;
    }
    audio.timer = setTimeout(() => this.scheduleLoops(), (loopLength * 1000) / 2);
  },

  stopAudio: function () {
    if (!this.audio) {
      return;
    }
    clearTimeout(this.audio.timer);
    let master = this.audio.master;
    let ctx = this.audio.ctx;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => master.disconnect(), 300);
    if (this.audio.ownCtx) {
      setTimeout(() => ctx.close(), 400);
    }
    this.audio = null;
  },

  scheduleSong: function (start, beatLength) {
    let t = start;
    // Melody: square and triangle an octave apart for a "choir" of guards
    PrinceJS.Party.MELODY.forEach((note) => {
      let duration = note[1] * beatLength;
      this.tone(note[0], t, duration * 0.92, "square", 0.32);
      this.tone(note[0] - 12, t, duration * 0.92, "triangle", 0.5);
      t += duration;
    });
    // Accompaniment: oom-pah-pah after the one-beat pickup
    PrinceJS.Party.CHORDS.forEach((chord, bar) => {
      let barStart = start + (1 + bar * 3) * beatLength;
      this.tone(chord[0], barStart, beatLength * 0.8, "triangle", 0.6);
      for (let beat = 1; beat < 3; beat++) {
        chord.slice(1).forEach((midi) => {
          this.tone(midi, barStart + beat * beatLength, beatLength * 0.3, "square", 0.07);
        });
      }
      this.noise(barStart, 0.05, 0.25);
    });
  },

  // "Woof woof": a quick falling pitch through a low-pass filter
  bark: function (dogIndex) {
    if (!this.audio) {
      return;
    }
    let ctx = this.audio.ctx;
    let pitch = [1, 0.75, 1.3][dogIndex % 3];
    [0, 0.18].forEach((delay) => {
      let start = ctx.currentTime + delay;
      let osc = ctx.createOscillator();
      let filter = ctx.createBiquadFilter();
      let gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(520 * pitch, start);
      osc.frequency.exponentialRampToValueAtTime(170 * pitch, start + 0.12);
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.9, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.13);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.audio.master);
      osc.start(start);
      osc.stop(start + 0.15);
    });
  },

  tone: function (midi, start, duration, type, volume) {
    let ctx = this.audio.ctx;
    let osc = ctx.createOscillator();
    let gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.01);
    gain.gain.setValueAtTime(volume, start + Math.max(0.02, duration - 0.04));
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.connect(gain);
    gain.connect(this.audio.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  },

  noise: function (start, duration, volume) {
    let ctx = this.audio.ctx;
    let length = Math.floor(ctx.sampleRate * duration);
    let buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    let data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    let source = ctx.createBufferSource();
    let gain = ctx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(this.audio.master);
    source.start(start);
  }
};
