define(["gbcore/audio/audio"], function(Audio){
    "use strict";

    var APUEmulator = {};

    /*//SO1 is left sound and SO2 is right sound

    var SO1Volume = 0;
    var SO2Volume = 0;

    var memoryController;

    var masterEnabled = false;

    var waveRAM = new Uint8Array(0x20);

    var audioContext = new AudioContext();

    var durationCycleConstant = 4194304 >> 8;
    var envelopeCycleConstant = 4194304 >> 6;

    var channel2Oscillator = audioContext.createOscillator();
    channel2Oscillator.frequency.value = 0;
    channel2Oscillator.type = 1;

    var channel2Gain = audioContext.createGainNode();
    channel2Gain.gain.value = 0;

    channel2Oscillator.connect(channel2Gain);

    channel2Gain.connect(audioContext.destination);

    var channel1Oscillator = audioContext.createOscillator();
    channel1Oscillator.frequency.value = 0;
    channel1Oscillator.type = 1;

    var channel1Gain = audioContext.createGainNode();
    channel1Gain.gain.value = 0;

    channel1Oscillator.connect(channel1Gain);

    channel1Gain.connect(audioContext.destination);



    var channels = [
        {//channel 1
            running: false,
            frequencyParam: 0,
            volumeParam: 0,
            stopAfterTime: false,
            lengthValue: 0,
            cyclesLeft: 0,
            envelopeDirection: 0,
            envelopeSpeed: 0,
            envelopeCycles: 0,
            stop: function(){
                this.running = false;
                channel1Oscillator.stop(0);
            },
            start: function(){
                this.running = true;
                channel1Oscillator.start(0);
            }
        },
        {//channel 2
            running: false,
            frequencyParam: 0,
            volumeParam: 0,
            stopAfterTime: false,
            lengthValue: 0,
            cyclesLeft: 0,
            envelopeDirection: 0,
            envelopeSpeed: 0,
            envelopeCycles: 0,
            stop: function(){
                this.running = false;
                channel2Oscillator.stop(0);
            },
            start: function(){
                this.running = true;
                channel2Oscillator.start(0);
            }
        },
        {running: false},
        {running: false}
    ];

    APUEmulator.setMemoryController = function(mController){
        memoryController = mController;
    }

    APUEmulator.reset = function(){
        allChannelsOff();
        updateSoundStates();
    }

    function updateSoundStates(){

        var value = masterEnabled ? 0x80 : 0;
        for (var i = 0, li = channels.length; i < li; i++){
            if (channels[i].running && channels[1].stopAfterTime && channels[1].cyclesLeft < 0){
                channels[i].running = false;
                channels[i].stop();
            }
            if (channels[i].running)
                value |= 1 << i;
        }
        memoryController.writeByte(0xFF26,value,true);
        channel2Oscillator.frequency.value =  131072/(2048-channels[1].frequencyParam);
        channel2Gain.gain.value = (channels[1].volumeParam) / 15;

        channel1Oscillator.frequency.value =  131072/(2048-channels[0].frequencyParam);
        channel1Gain.gain.value = (channels[0].volumeParam) / 15;
    }

    function allChannelsOff(){
        for (var i = 0, li = channels.length; i < li; i++){
            channels[i].running = false;
        }
    }

    APUEmulator.updateCycles = function(cycles){
        for (var i = 0, li = channels.length; i < li; i++){
            if (channels[i].running && channels[1].stopAfterTime)
                channels[i].cyclesLeft -= cycles;

        }
        for (var i = 0; i < 2; i++){
            if (channels[i].envelopeSpeed > 0){
                if (channels[i].envelopeDirection == 0){ //decrease
                    if (channels[i].volumeParam > 0){
                        var cyclesNeeded = envelopeCycleConstant * channels[i].envelopeSpeed;
                        channels[i].envelopeCycles += cycles;
                        if (channels[i].envelopeCycles >= cyclesNeeded){
                            channels[i].volumeParam--;
                            channels[i].envelopeCycles -= cyclesNeeded;
                        }
                    }
                }
                else{
                    if (channels[i].volumeParam < 15){
                        var cyclesNeeded = envelopeCycleConstant * channels[i].envelopeSpeed;
                        channels[i].envelopeCycles += cycles;
                        if (channels[i].envelopeCycles >= cyclesNeeded){
                            channels[i].volumeParam++;
                            channels[i].envelopeCycles -= cyclesNeeded;
                        }
                    }
                }
            }
        }
        updateSoundStates();
    }

    APUEmulator.IORegisterWritten = function(address,value){
        switch (address){
            case 0xFF10://channel 1 sweep
                break;
            case 0xFF11://channel 1 length/wave pattern duty
                //TODO: support wave duty
                channels[0].lengthValue = value & 0x3F;
                channels[0].cyclesLeft = (63 - channels[0].lengthValue) * durationCycleConstant;
                break;
            case 0xFF12://channel 1 volume envelope
                channels[0].volumeParam = value >> 4
                channels[0].envelopeDirection = (value >> 3) & 1;
                channels[0].envelopeSpeed = (value & 7);
                channels[0].envelopeCycles = 0;
                updateSoundStates();
                break;
            case 0xFF13://channel 1 frequency lo
                channels[0].frequencyParam = (channels[0].frequencyParam & 0x700) | value;
                updateSoundStates();
                if (channels[0].running)
                    channels[0].start();
                break;
                break;
            case 0xFF14://channel 1 frequency hi
                var startRunning = (value & 0x80) != 0;
                channels[0].running = startRunning;
                channels[0].stopAfterTime = (value & 0x40) != 0;
                if (channels[0].running)
                    channels[0].cyclesLeft = (63 - channels[0].lengthValue) * durationCycleConstant;

                channels[0].frequencyParam = (channels[0].frequencyParam & 0xFF) | ((value & 7) << 8);
                updateSoundStates();
                if (startRunning)
                    channels[0].start();
                else
                    channels[0].stop();
                break;
            case 0xFF16://channel 2 sound length/wave pattern duty
                //TODO: support wave duty
                channels[1].lengthValue = value & 0x3F;
                channels[1].cyclesLeft = (63 - channels[1].lengthValue) * durationCycleConstant;
                break;
            case 0xFF17://channel 2 volume envelope
                channels[1].volumeParam = value >> 4
                channels[1].envelopeDirection = (value >> 3) & 1;
                channels[1].envelopeSpeed = (value & 7);
                channels[1].envelopeCycles = 0;
                updateSoundStates();
                break;
            case 0xFF18://channel 2 frequency lo
                channels[1].frequencyParam = (channels[1].frequencyParam & 0x700) | value;
                updateSoundStates();
                if (channels[1].running)
                    channels[1].start();
                break;
            case 0xFF19://channel 2 frequency hi
                var startRunning = (value & 0x80) != 0;
                channels[1].running = startRunning;
                channels[1].stopAfterTime = (value & 0x40) != 0;
                if (channels[1].running)
                    channels[1].cyclesLeft = (63 - channels[1].lengthValue) * durationCycleConstant;

                channels[1].frequencyParam = (channels[1].frequencyParam & 0xFF) | ((value & 7) << 8);
                updateSoundStates();
                if (startRunning)
                    channels[1].start();
                else
                    channels[1].stop();
                break;
            case 0xFF1A://channel 3 sound on/off
                break;
            case 0xFF1B://channel 3 sound length;
                break;
            case 0xFF1C://channel 3 output level
                break;
            case 0xFF1D://channel 3 frequency lo
                break;
            case 0xFF1E://channel 3 frequency hi
                channels[2].running = (value & 0x80) != 0;
                updateSoundStates();
                break;
            case 0xFF20://channel 4 sound length;
                break;
            case 0xFF21://channel 4 volume envelope
                break;
            case 0xFF22://channel 4 polynomial counter;
                break;
            case 0xFF23://channel 4 counter/consecutive
                channels[3].running = (value & 0x80) != 0;
                updateSoundStates();
                break;
            case 0xFF24://external channel controller and master volume
                //no support for external sound channel
                SO1Volume = ((value << 4) & 8) / 8;
                SO2Volume = (value & 8) / 8;
                break;
            case 0xFF25://sound channel controller
                break;
            case 0xFF26://sound on/off
                masterEnabled = (value & 0x80) != 0;
                if (!masterEnabled)
                    allChannelsOff();
                updateSoundStates();
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
                waveRAM[(address - 0xFF30) * 2] = (value >> 4);
                waveRAM[(address - 0xFF30) * 2 + 1] = (value & 16)
                break;
        }
    }         */

    var memoryController;
    var audio = new Audio(null);

    APUEmulator.setMemoryController = function(mController){
        memoryController = mController;
        audio.setMemoryController(memoryController);
    }

    var lastUpdate = new Date().getTime();

    APUEmulator.reset = function(){

        audio.reset();
        this.start();
    }

    APUEmulator.updateCycles = function(cycles){
        audio.clock(cycles << 1);
    }

    APUEmulator.IORegisterWritten = function(address,value){
        audio.IORegisterWritten(address,value);
    }

    APUEmulator.setVolume = function(volume){
        audio.setVolume(volume);
    }

    APUEmulator.getVolume = function(){
        return audio.getVolume();
    }

    APUEmulator.start = function(){
        audio.play();
    }

    APUEmulator.stop = function(){
        audio.mute();
    }

    APUEmulator.getSaveState = function(){
        return audio.getSaveState();
    }

    APUEmulator.setSaveState = function(saveState){
        audio.setSaveState(saveState);
    }



    return APUEmulator;
});