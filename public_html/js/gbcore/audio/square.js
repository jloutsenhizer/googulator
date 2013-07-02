define(function () {
    function SquareChannel(){
    }

    SquareChannel.prototype.reset = function () {
        this.enabled = false;

        // Envelope system
        this.envelopeRegister = 0;
        this.envelopeCounter = 0;
        this.envelopeTick = 0;
        this.envelopeDirection = -1;
        this.envelopePeriod = 0;

        // Sweep system
        this.sweepRegister = 0;
        this.sweepCounter = 0;
        this.sweepTick = 0;
        this.sweepPeriod = 0;

        this.lengthEnable = 0;
        this.lengthCounter = 0;
        this.frequency = 0;

        this.sample = 0;
        this.frequencyCounter = 0;

        this.initalVolume = 0;
        this.duty = 0;
        this.length = 0;
        this.waveform = 0x01;
    };

    SquareChannel.prototype.getSaveState = function(){
        return {
            enabled: this.enabled,
            envelopeRegister: this.envelopeRegister,
            envelopeCounter: this.envelopeCounter,
            envelopeDirection: this.envelopeDirection,
            envelopePeriod: this.envelopePeriod,
            sweepRegister: this.sweepRegister,
            sweepCounter: this.sweepCounter,
            sweepTick: this.sweepTick,
            sweepPeriod: this.sweepPeriod,
            lengthEnable: this.lengthEnable,
            lengthCounter: this.lengthCounter,
            frequency: this.frequency,
            sample: this.sample,
            frequencyCounter: this.frequencyCounter,
            initalVolume: this.initalVolume,
            duty: this.duty,
            length: this.length,
            waveform: this.waveform
        };
    }

    SquareChannel.prototype.setSaveState = function(saveState){
        this.enabled = saveState.enabled;
        this.envelopeRegister = saveState.envelopeRegister;
        this.envelopeCounter = saveState.envelopeCounter;
        this.envelopeDirection = saveState.envelopeDirection;
        this.envelopePeriod = saveState.envelopePeriod;
        this.sweepRegister = saveState.sweepRegister;
        this.sweepCounter = saveState.sweepCounter;
        this.sweepTick = saveState.sweepTick;
        this.sweepPeriod = saveState.sweepPeriod;
        this.lengthEnable = saveState.lengthEnable;
        this.lengthCounter = saveState.lengthCounter;
        this.frequency = saveState.frequency;
        this.sample = saveState.sample;
        this.frequency = saveState.frequencyCounter;
        this.initalVolume = saveState.initalVolume;
        this.duty = saveState.duty;
        this.length = saveState.length;
        this.waveform = saveState.waveform;
    }

    SquareChannel.prototype.clock = function (ticks) {
        if (!this.enabled) { return ; }

        this.frequencyCounter += ticks;

        // Length counter
        if (this.lengthEnable) {
            this.lengthCounter += ticks;
            if (this.lengthCounter >= 32768) {
                this.length = (this.length + 1) & 0x3F;
                this.enabled = this.length != 0;
                this.lengthCounter &= 32767;
            }
        }

        // Envelope system
        if (this.envelopePeriod) {
            this.envelopeCounter += ticks;
            if (this.envelopeCounter >= 131072) {
                if (++this.envelopeTick == this.envelopePeriod) {
                    this.volume += this.envelopeDirection;
                    if (this.volume < 0) {
                        this.volume = 0;
                        this.envelopePeriod = 0;
                    } else if (this.volume > 1) {
                        this.volume = 1;
                        this.envelopePeriod = 0;
                    }

                    this.envelopeTick = 0;
                }
                this.envelopeCounter &= 131071;
            }
        }

        // Sweep system
        if (this.sweepPeriod) {
            this.sweepCounter += ticks;
            if (this.sweepCounter >= 65535) {
                if (++this.sweepTick == this.sweepPeriod) {
                    this.activeFrequency += (this.activeFrequency >> this.sweepShift) * this.sweepDirection;

                    if (this.activeFrequency >= 2048) { this.enabled = false; }

                    this.overflow = (2048 - this.activeFrequency) * 8;
                    this.sweepTick = 0;
                }

                this.sweepCounter &= 65535;
            }
        }
    };

    SquareChannel.prototype.level = function () {
        if (!this.enabled) { return 0; }

        // Determine our current sample
        this.sample = (this.sample + (this.frequencyCounter / this.overflow)) & 7;
        this.frequencyCounter %= this.overflow;

        return ((this.waveform >> this.sample) & 1) * this.volume;
    };

    SquareChannel.prototype.active = function () {
        return this.enabled;
    }

    // --- Registers
    SquareChannel.prototype.write_sweep = function (d) {
        this.sweepPeriod = (d >> 4) & 7;
        this.sweepDirection = (d & 8) ? -1 : 1;
        this.sweepShift = d & 7;

        return 0x80 | d;
    };

    SquareChannel.prototype.write_length = function (d) {
        this.duty = d & 0xC0;
        this.length = d & 0x3F;

        switch(this.duty) {
            case 0x00:
                this.waveform = 0x01;
                break ;
            case 0x40:
                this.waveform = 0x81;
                break ;
            case 0x80:
                this.waveform = 0x87;
                break ;
            case 0xC0:
                this.waveform = 0x7E;
                break ;
        }

        return 0x3F | this.duty;
    };

    SquareChannel.prototype.write_volume = function (d) {
        this.initalVolume = (d >> 4) / 15.0;
        this.envelopeDirection = (d & 8) ? (1.0/15) : (-1.0/15);
        this.envelopePeriod = d & 7;

        return d;
    };

    SquareChannel.prototype.write_freq_lo = function (d) {
        this.frequency = (this.frequency & 0xFF00) | (d);
    };

    SquareChannel.prototype.write_freq_hi = function (d) {
        this.frequency = (this.frequency & 0x00FF) | ((d & 0x07) << 8);
        this.lengthEnable = d & 0x40;

        // Sound frequency
        if (d & 0x80) {

            this.enabled = true;
            this.activeFrequency = this.frequency;
            this.overflow = (2048 - this.activeFrequency) * 8;

            this.frequencyCounter = 0;
            this.lengthCounter = 0;

            this.envelopeCounter = 0;
            this.envelopeTick = 0;

            this.sweepCounter = 0;
            this.sweepTick = 0;

            this.volume = this.initalVolume;
        }

        return 0xBF | this.lengthEnable;
    };

    return SquareChannel;
});