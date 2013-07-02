define(["CopyUtils"], function (CopyUtils) {
    function WaveformChannel() {
        this.waveform = new Uint8Array(0x10);
    }

    WaveformChannel.prototype.reset = function () {
        this.enabled = false;
        this.channelEnable = 0;

        this.frequency = 0;
        this.overflow = 0;

        this.lengthEnable = 0;
        this.lengthCounter = 0;
        this.length = 0;

        this.frequencyCounter = 0;
        this.sample = 0;

        this.volume = 0;
    };

    WaveformChannel.prototype.getSaveState = function(){
        return {
            waveform: CopyUtils.makeUntypedArrayCopy(this.waveform),
            enabled: this.enabled,
            channelEnable: this.channelEnable,
            frequency: this.frequency,
            overflow: this.overflow,
            lengthEnable: this.lengthEnable,
            lengthCounter: this.lengthCounter,
            length: this.length,
            frequencyCounter: this.frequencyCounter,
            sample: this.sample,
            volume: this.volume
        };
    }

    WaveformChannel.prototype.setSaveState = function(saveState){
        CopyUtils.copy(saveState.waveform,this.waveform);
        this.enabled = saveState.enabled;
        this.channelEnable = saveState.channelEnable;
        this.frequency = saveState.frequency;
        this.overflow = saveState.overflow;
        this.lengthEnable = saveState.lengthEnable;
        this.lengthCounter = saveState.lengthCounter;
        this.length = saveState.length;
        this.frequencyCounter = saveState.frequencyCounter;
        this.sample = saveState.sample;
        this.volume = saveState.volume;

    }

    WaveformChannel.prototype.clock = function (ticks) {
        if (!this.enabled || !this.channelEnable) { return ; }

        this.frequencyCounter += ticks;

        // Length counter
        if (this.lengthEnable) {
            this.lengthCounter += ticks;
            if (this.lengthCounter >= 32768) {
                this.length = (this.length + 1) & 0xFF;
                this.enabled = this.length != 0;
                this.lengthCounter &= 32767;
            }
        }
    };

    WaveformChannel.prototype.level = function () {
        if (!this.enabled || !this.channelEnable) { return 0; }

        this.sample = (this.sample + (this.frequencyCounter / this.overflow)) & 31;
        this.frequencyCounter %= this.overflow;

        // Determine our current sample
        var i = this.sample,
            shift = (i & 1) ? 0 : 4,
            sample = (this.waveform[i>>1] >> shift) & 0xF;

        return sample * this.volume;
    };

    WaveformChannel.prototype.active = function () {
        return this.enabled && this.channelEnable;
    }

    // --- Registers
    WaveformChannel.prototype.write_enable = function (d) {
        this.channelEnable = d & 0x80;

        return 0x7F | this.channelEnable;
    };

    WaveformChannel.prototype.write_length = function (d) {
        this.length = d;
    };

    WaveformChannel.prototype.write_level = function (d) {
        switch (d & 0x60) {
            case 0x00:
                this.volume = 0;
                break ;
            case 0x20:
                this.volume = 1.00 / 15;
                break ;
            case 0x40:
                this.volume = 0.50 / 15;
                break ;
            case 0x60:
                this.volume = 0.25 / 15;
                break ;
        }

        return 0x9F | d;
    };

    WaveformChannel.prototype.write_freq_lo = function (d) {
        this.frequency = (this.frequency & 0xFF00) | (d);
    };

    WaveformChannel.prototype.write_freq_hi = function (d) {
        this.frequency = (this.frequency & 0x00FF) | ((d & 0x07) << 8);
        this.lengthEnable = d & 0x40;

        // Sound frequency
        if (d & 0x80) {

            this.enabled = true;
            this.frequencyCounter = 0;
            this.sample = 0;

            this.lengthCounter = 0;
            this.overflow = (2048 - this.frequency) * 4;
        }

        return 0xBF | this.lengthEnable;
    };

    return WaveformChannel;
});