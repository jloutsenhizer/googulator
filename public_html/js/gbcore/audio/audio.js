define([
    "gbcore/audio/square",
    "gbcore/audio/waveform",
    "gbcore/audio/noise",
    "CopyUtils"
], function (SquareChannel, WaveformChannel, NoiseChannel, CopyUtils) {
    var BUFFER_LENGTH = 2048,               // ~91ms buffer
       LONG_BUFFER   = BUFFER_LENGTH * 2,  // Render to a much larger buffer
    CLOCK_RATE    = 8388608;

    function Sound(memoryController) {
        this.memoryController = memoryController;
        this.square1 = new SquareChannel();
        this.square2 = new SquareChannel();
        this.waveform = new WaveformChannel();
        this.noise = new NoiseChannel();
        this.connected = false;

        this.node = this.context.createJavaScriptNode(BUFFER_LENGTH);
        this.gainNode = this.context.createGainNode();
        this.volume = 0;
        this.gainNode.gain.value = this.volume;
        this.node.connect(this.gainNode);
        var sound = this;
        this.node.onaudioprocess = function(e){
            return sound.process(e);
        };
        this.sampleRate = Sound.prototype.context.sampleRate;

        this.leftBuffer = new Float32Array(LONG_BUFFER);
        this.rightBuffer = new Float32Array(LONG_BUFFER);

        // Playback buffering
        this.activeSample = 0;      // Next sample written
        this.sampleTime = 0;        // Bresenham sample counter
    }

    Sound.prototype.getSaveState = function(){
        return {
            square1: this.square1.getSaveState(),
            square2: this.square2.getSaveState(),
            waveform: this.waveform.getSaveState(),
            noise: this.noise.getSaveState(),
            leftBuffer: CopyUtils.makeUntypedArrayCopy(this.leftBuffer),
            rightBuffer: CopyUtils.makeUntypedArrayCopy(this.rightBuffer),
            activeSample: this.activeSample,
            sampleTime: this.sampleTime
        };
    }

    Sound.prototype.setSaveState = function(saveState){
        this.square1.setSaveState(saveState.square1);
        this.square2.setSaveState(saveState.square2);
        this.waveform.setSaveState(saveState.waveform);
        this.noise.setSaveState(saveState.noise);
        CopyUtils.copy(saveState.leftBuffer,this.leftBuffer);
        CopyUtils.copy(saveState.rightBuffer,this.rightBuffer);
        this.activeSample = saveState.activeSample;
        this.sampleTime = saveState.sampleTime;
    }

    Sound.prototype.setMemoryController = function(memoryController){
        this.memoryController = memoryController;
    }

    Sound.prototype.setVolume = function(volume){
        this.volume = volume;
        this.gainNode.gain.value = volume;
    }

    Sound.prototype.getVolume = function(){
        return this.volume;
    }

    Sound.prototype.clock = function (ticks) {
        if (this.getVolume() == 0)
            return;
        var s;

        this.sampleTime += ticks * this.sampleRate;

        if (!this.masterEnable) {
            while (this.sampleTime >= CLOCK_RATE) {
                s = this.activeSample;

                this.sampleTime -= CLOCK_RATE;
                this.rightBuffer[s] = 0;
                this.leftBuffer[s] = 0;

                if (++this.activeSample >= LONG_BUFFER) {
                    this.activeSample = 0;
                }
            }
            return ;
        }

        this.square1.clock(ticks);
        this.square2.clock(ticks);
        this.waveform.clock(ticks);
        this.noise.clock(ticks);

        while (this.sampleTime >= CLOCK_RATE) {
            var ch0 = this.square1.level(),
                ch1 = this.square2.level(),
                ch2 = this.waveform.level(),
                ch3 = this.noise.level();

            s = this.activeSample;
            this.sampleTime -= CLOCK_RATE;

            this.rightBuffer[s] = (
                ch0*this.ch0right +
                    ch1*this.ch1right +
                    ch2*this.ch2right +
                    ch3*this.ch3right) * this.rightVolume * 0.25;

            this.leftBuffer[s] = (
                ch0*this.ch0left +
                    ch1*this.ch1left +
                    ch2*this.ch2left +
                    ch3*this.ch3left) * this.leftVolume * 0.25;

            if (++this.activeSample >= LONG_BUFFER) {
                this.activeSample = 0;
            }
        }

        this.memoryController.writeByte(0xFF26,this.read_NR52(),true);
    };

    Sound.prototype.reset = function () {

        this.square1.reset();
        this.square2.reset();
        this.waveform.reset();
        this.noise.reset();

        this.leftVolume = 0;
        this.rightVolume = 0;
        this.masterEnable = 0;

        this.ch0right = 0;
        this.ch1right = 0;
        this.ch2right = 0;
        this.ch3right = 0;
        this.ch0left  = 0;
        this.ch1left  = 0;
        this.ch2left  = 0;
        this.ch3left  = 0;
    };

    // Don't assume audio is available
    Sound.prototype.context = new AudioContext();

    Sound.prototype.mute = function () {
        if (!this.node) { return ; }
        if (!this.connected) return;

        this.gainNode.disconnect();
        this.connected = false;
    };

    Sound.prototype.play = function () {
        if (!this.node) { return ; }

        if (this.connected) return;

        this.gainNode.connect(this.context.destination);
        this.connected = true;
    };

    Sound.prototype.process = function (e) {
        if (this.getVolume() == 0)
            return;
        var left = e.outputBuffer.getChannelData(0),
            right = e.outputBuffer.getChannelData(1),
            length = left.length,
            s = (this.activeSample & BUFFER_LENGTH) ^ BUFFER_LENGTH,
            i = 0;

        for(; i < length; i++, s++) {
            left[i] = this.leftBuffer[s];
            right[i] = this.rightBuffer[s];
        }
    }

    // --- Control registers
    Sound.prototype.write_NR50 = function (d) {
        this.NR50 = d;

        // Nothing uses VIN, ignored for now
        this.leftVolume =  ((d & 0x70) >> 4) / 7.0;
        this.rightVolume = (d & 0x07) / 7.0;
    };

    Sound.prototype.write_NR51 = function (d) {
        this.NR51 = d;

        this.ch0right = (d >> 0) & 1;
        this.ch1right = (d >> 1) & 1;
        this.ch2right = (d >> 2) & 1;
        this.ch3right = (d >> 3) & 1;
        this.ch0left  = (d >> 4) & 1;
        this.ch1left  = (d >> 5) & 1;
        this.ch2left  = (d >> 6) & 1;
        this.ch3left  = (d >> 7) & 1;
    };

    Sound.prototype.write_NR52 = function (d) {
        this.masterEnable = d & 0x80;
        return this.read_NR52();
    };

    Sound.prototype.read_NR52 = function () {
        if (!this.masterEnable) { return 0; }

        return this.masterEnable |
            (this.square1.active() ? 1 : 0) |
            (this.square2.active() ? 2 : 0) |
            (this.waveform.active() ? 4 : 0) |
            (this.noise.active() ? 8 : 0);
    };

    Sound.prototype.IORegisterWritten = function(address,value){
        var writeBack = null;
        switch (address){
            case 0xFF10://channel 1 sweep
                writeBack = this.square1.write_sweep(value);
                break;
            case 0xFF11://channel 1 length/wave pattern duty
                writeBack = this.square1.write_length(value);
                break;
            case 0xFF12://channel 1  envelope
                writeBack = this.square1.write_volume(value);
                break;
            case 0xFF13://channel 1 frequency lo
                writeBack = this.square1.write_freq_lo(value);
                break;
            case 0xFF14://channel 1 frequency hi
                writeBack = this.square1.write_freq_hi(value);
                break;
            case 0xFF16://channel 2 sound length/wave pattern duty
                writeBack = this.square2.write_length(value);
                break;
            case 0xFF17://channel 2 volume envelope
                writeBack = this.square2.write_volume(value);
                break;
            case 0xFF18://channel 2 frequency lo
                writeBack = this.square2.write_freq_lo(value);
                break;
            case 0xFF19://channel 2 frequency hi
                writeBack = this.square2.write_freq_hi(value);
                break;
            case 0xFF1A://channel 3 sound on/off
                writeBack = this.waveform.write_enable(value);
                break;
            case 0xFF1B://channel 3 sound length;
                writeBack = this.waveform.write_length(value);
                break;
            case 0xFF1C://channel 3 output level
                writeBack = this.waveform.write_level(value);
                break;
            case 0xFF1D://channel 3 frequency lo
                writeBack = this.waveform.write_freq_lo(value);
                break;
            case 0xFF1E://channel 3 frequency hi
                writeBack = this.waveform.write_freq_hi(value);
                break;
            case 0xFF20://channel 4 sound length;
                writeBack = this.noise.write_length(value);
                break;
            case 0xFF21://channel 4 volume envelope
                writeBack = this.noise.write_volume(value);
                break;
            case 0xFF22://channel 4 polynomial counter;
                writeBack = this.noise.write_poly(value);
                break;
            case 0xFF23://channel 4 counter/consecutive
                writeBack = this.noise.write_control(value);
                break;
            case 0xFF24://external channel controller and master volume
                writeBack = this.write_NR50(value);
                break;
            case 0xFF25://sound channel controller
                writeBack = this.write_NR51(value);
                break;
            case 0xFF26://sound on/off
                writeBack = this.write_NR52(value);
                break;
            case 0xFF30:
            case 0xFF31:
            case 0xFF32:
            case 0xFF33:
            case 0xFF34:
            case 0xFF35:
            case 0xFF36:
            case 0xFF37:
            case 0xFF38:
            case 0xFF39:
            case 0xFF3A:
            case 0xFF3B:
            case 0xFF3C:
            case 0xFF3D:
            case 0xFF3E:
            case 0xFF3F://wave storage
                this.waveform.waveform[address - 0xFF30] = value;
                break;
        }
        if (writeBack != null)
            this.memoryController.writeByte(address,writeBack,true);
    }

    return Sound;
});