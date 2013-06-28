/*
JSNES, based on Jamie Sanders' vNES
Copyright (C) 2010 Ben Firshman

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

define(["nescore/cpu","nescore/ppu","nescore/papu","nescore/joypad","nescore/rom"],function(CPU,PPU,PAPU,Joypad,ROM){
    var JSNES = function(opts) {
        this.opts = {
            preferredFrameRate: 60,
            fpsInterval: 500, // Time between updating FPS in ms
            showDisplay: true,

            emulateSound: true,
            sampleRate: new AudioContext().sampleRate, // Sound sample rate in hz

            CPU_FREQ_NTSC: 1789772.5, //1789772.72727272d;
            CPU_FREQ_PAL: 1773447.4,
            canvas: null
        };
        if (typeof opts != 'undefined') {
            var key;
            for (key in this.opts) {
                if (typeof opts[key] != 'undefined') {
                    this.opts[key] = opts[key];
                }
            }
        }

        this.frameTime = 1000 / this.opts.preferredFrameRate;

        this.cpu = new CPU(this);
        this.ppu = new PPU(this);
        this.papu = new PAPU(this);
        this.mmap = null; // set in loadRom()
        this.joypad = new Joypad();
    };

    JSNES.prototype = {
        isRunning: false,
        fpsFrameCount: 0,
        romData: null,

        // Resets the system
        reset: function() {
            this.cpu.reset();
            this.ppu.reset();
            this.papu.reset();

            if (this.mmap !== null) {
                this.mmap.reset();
            }

        },

        start: function() {
            var self = this;

            if (this.rom != null && this.rom.valid) {
                if (!this.isRunning) {
                    this.isRunning = true;

                    this.frameInterval = setInterval(function() {
                        self.frame();
                    }, this.frameTime);
                    this.resetFps();
                }
            }
        },

        frame: function() {
            this.ppu.startFrame();
            var cycles = 0;
            var emulateSound = this.opts.emulateSound && this.papu.getVolume() > 0;
            var cpu = this.cpu;
            var ppu = this.ppu;
            var papu = this.papu;
            FRAMELOOP: for (;;) {
                if (cpu.cyclesToHalt === 0) {
                    // Execute a CPU instruction
                    cycles = cpu.emulate();
                    if (emulateSound) {
                        papu.clockFrameCounter(cycles);
                    }
                    cycles *= 3;
                }
                else {
                    if (cpu.cyclesToHalt > 8) {
                        cycles = 24;
                        if (emulateSound) {
                            papu.clockFrameCounter(8);
                        }
                        cpu.cyclesToHalt -= 8;
                    }
                    else {
                        cycles = cpu.cyclesToHalt * 3;
                        if (emulateSound) {
                            papu.clockFrameCounter(cpu.cyclesToHalt);
                        }
                        cpu.cyclesToHalt = 0;
                    }
                }

                for (; cycles > 0; cycles--) {
                    if(ppu.curX === ppu.spr0HitX &&
                        ppu.f_spVisibility === 1 &&
                        ppu.scanline - 21 === ppu.spr0HitY) {
                        // Set sprite 0 hit flag:
                        ppu.setStatusFlag(ppu.STATUS_SPRITE0HIT, true);
                    }

                    if (ppu.requestEndFrame) {
                        ppu.nmiCounter--;
                        if (ppu.nmiCounter === 0) {
                            ppu.requestEndFrame = false;
                            ppu.startVBlank();
                            break FRAMELOOP;
                        }
                    }

                    ppu.curX++;
                    if (ppu.curX === 341) {
                        ppu.curX = 0;
                        ppu.endScanline();
                    }
                }
            }
            this.fpsFrameCount++;
            this.lastFrameTime = +new Date();
        },

        getFPS: function() {
            var now = +new Date();
            var fps = 0;
            if (this.lastFpsTime) {
                fps =  this.fpsFrameCount / ((now - this.lastFpsTime) / 1000);
            }
            this.fpsFrameCount = 0;
            this.lastFpsTime = now;
            return fps;
        },

        stop: function() {
            clearInterval(this.frameInterval);
            clearInterval(this.fpsInterval);
            this.isRunning = false;
        },

        reloadRom: function() {
            if (this.romData !== null) {
                this.loadROM(this.romData);
            }
        },

        // Loads a ROM file into the CPU and PPU.
        // The ROM file is validated first.
        loadROM: function(game) {
            if (this.isRunning) {
                this.stop();
            };

            // Load ROM file:
            this.game = game;
            this.rom = new ROM(this);
            this.rom.load(game);


            var valid = this.rom.valid;

            if (valid) {
                this.reset();
                this.mmap = this.rom.createMapper();
                if (!this.mmap) {
                    return;
                }
                this.mmap.loadROM();
                this.ppu.setMirroring(this.rom.getMirroringType());
                this.romData = game.data;
            }
            else{
                this.rom = null;
                this.game =  null;
            }
            return valid;
        },

        unloadROM: function(callback,saveprogresscallback){
            if (this.game == null){
                callback();
                return;
            }
            if (this.isRunning)
                this.stop();
            var that = this;
            this.game.updateSaveData(this.rom.getSaveData(),function(){
                that.game = null;
                that.rom = null;
                callback();
            },saveprogresscallback);
        },

        resetFps: function() {
            this.lastFpsTime = null;
            this.fpsFrameCount = 0;
        },

        setFramerate: function(rate){
            this.opts.preferredFrameRate = rate;
            this.frameTime = 1000 / rate;
            this.papu.setSampleRate(this.opts.sampleRate, false);
        },

        getVolume: function(){
            return this.papu.getVolume();
        },

        setVolume: function(volume){
            this.papu.setVolume(volume);
        },

        toJSON: function() {
            return {
                'romData': this.romData,
                'cpu': this.cpu.toJSON(),
                'mmap': this.mmap.toJSON(),
                'ppu': this.ppu.toJSON()
            };
        },

        fromJSON: function(s) {
            this.loadRom(s.romData);
            this.cpu.fromJSON(s.cpu);
            this.mmap.fromJSON(s.mmap);
            this.ppu.fromJSON(s.ppu);
        },

        hasGame: function(){
            return this.game != null;
        }
    };

    return JSNES;
})
