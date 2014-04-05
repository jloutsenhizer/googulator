define (function(){
    "use strict";

    var CPUEmulator = {};

    var debug = false;



    var AF = 0;
    var BC = 0;
    var DE = 0;
    var HL = 0;
    var SP = 0;
    var PC = 0;
    var suspended = false;
    var IME = 0;
    var divCounter;
    var timerCounter;
    var timerSpeed;
    var timerEnabled;
    var doubleSpeedMode;
    var enteringDoubleSpeedMode;
    var gbcEnabled;
    window.INT_VBLANK = 0, window.INT_LCDSTAT = 1, window.INT_TIMER = 2, window.INT_SERIAL = 3, window.INT_JPAD = 4;

    var gameShark;

    CPUEmulator.setGameshark = function(g){
        gameShark = g;
    }

    CPUEmulator.getSaveState = function(){
        return {
            AF: AF,
            BC: BC,
            DE: DE,
            HL: HL,
            SP: SP,
            PC: PC,
            suspended: suspended,
            IME: IME,
            divCounter: divCounter,
            timerCounter: timerCounter,
            timerEnabled: timerEnabled,
            timerSpeed: timerSpeed,
            doubleSpeedMode: doubleSpeedMode,
            enteringDoubleSpeedMode: enteringDoubleSpeedMode,
            gbcEnabled: gbcEnabled
        }
    }

    CPUEmulator.setSaveState = function(saveState){
        AF = saveState.AF;
        BC = saveState.BC;
        DE = saveState.DE;
        HL = saveState.HL;
        SP = saveState.SP;
        PC = saveState.PC;
        suspended = saveState.suspended;
        IME = saveState.IME;
        divCounter = saveState.divCounter;
        timerCounter = saveState.timerCounter;
        timerSpeed = saveState.timerSpeed;
        doubleSpeedMode = saveState.doubleSpeedMode;
        enteringDoubleSpeedMode = saveState.enteringDoubleSpeedMode;
        gbcEnabled = saveState.gbcEnabled;
    }

    var timerSpeeds = [1024, 16, 64, 256];

    var memoryController = null;

    CPUEmulator.setGBCEnabled = function(enabled){
        gbcEnabled = enabled;
    }

    function ret(){
        PC = memoryController.readWord(SP);
        SP += 2;
        SP &= 0xFFFF;
    }

    function call(address){
        SP -= 2;
        SP &= 0xFFFF;
        memoryController.writeWord(SP,PC);
        PC = address;
    }

    CPUEmulator.getA = function(){
        return (AF >> 8) & 0xFF;
    }

    CPUEmulator.setA = function(value){
        AF = ((value & 0xFF) << 8) | (AF & 0xFF);
    }

    CPUEmulator.getB = function(){
        return (BC >> 8) & 0xFF;
    }

    CPUEmulator.setB = function(value){
        BC = ((value & 0xFF) << 8) | this.getC();
    }

    CPUEmulator.getC = function(){
        return BC & 0xFF;
    }

    CPUEmulator.setC = function(value){
        BC = (this.getB() << 8) | (value & 0xFF);
    }

    CPUEmulator.getD = function(){
        return (DE >> 8) & 0xFF;
    }

    CPUEmulator.setD = function(value){
        DE = ((value & 0xFF) << 8) | this.getE();
    }

    CPUEmulator.getE = function(){
        return DE & 0xFF;
    }

    CPUEmulator.setE = function(value){
        DE = (this.getD() << 8) | (value & 0xFF);
    }

    CPUEmulator.getH = function(){
        return (HL >> 8) & 0xFF;
    }

    CPUEmulator.setH = function(value){
        HL = ((value & 0xFF) << 8) | this.getL()
    }

    CPUEmulator.getL = function(){
        return HL & 0xFF;
    }

    CPUEmulator.setL = function(value){
        HL = (this.getH() << 8) | (value & 0xFF);
    }

    CPUEmulator.setZero = function(value){
        if (value){
            AF |= 0x80;
        }
        else{
            AF &= 0xFF7F;
        }
    }

    CPUEmulator.getZero = function(){
        return (AF & 0x80) == 0x80;
    }

    CPUEmulator.setSubtract = function(value){
        if (value){
            AF |= 0x40;
        }
        else{
            AF &= 0xFFBF;
        }
    }

    CPUEmulator.getSubtract = function(){
        return (AF & 0x40) == 0x40
    }

    CPUEmulator.setHalfCarry = function(value){
        if (value){
            AF |= 0x20;
        }
        else{
            AF &= 0xFFDF;
        }
    }

    CPUEmulator.getHalfCarry = function(){
        return (AF & 0x20) == 0x20;
    }

    CPUEmulator.setCarry = function(value){
        if (value){
            AF |= 0x10;
        }
        else{
            AF &= 0xFFEF;
        }
    }

    CPUEmulator.getCarry = function(){
        return (AF & 0x10) == 0x10;
    }

    CPUEmulator.getIndexed8BitRegister = function(index){
        switch (index){
            case 0:
                return this.getB();
            case 1:
                return this.getC();
            case 2:
                return this.getD();
            case 3:
                return this.getE();
            case 4:
                return this.getH();
            case 5:
                return this.getL();
            case 6:
                return memoryController.readByte(HL);
            case 7:
                return this.getA();
            default:
                console.error("Unknown register index: " + index);
        }
    }

    CPUEmulator.setIndexed8BitRegister = function(index, value){
        switch (index){
            case 0:
                this.setB(value);
                break;
            case 1:
                this.setC(value);
                break;
            case 2:
                this.setD(value);
                break;
            case 3:
                this.setE(value);
                break;
            case 4:
                this.setH(value);
                break;
            case 5:
                this.setL(value);
                break;
            case 6:
                memoryController.writeByte(HL,value);
                break;
            case 7:
                this.setA(value);
                break;
            default:
                console.error("Unknown register index: " + index);
        }
    }

    CPUEmulator.getIndexedPointerRegister = function(index){
        switch (index){
            case 0:
                return memoryController.readByte(BC);
            case 1:
                return memoryController.readByte(DE);
            case 2:
            {
                var val = memoryController.readByte(HL++);
                HL &= 0xFFFF;
                return val;
            }
            case 3:
            {
                var val = memoryController.readByte(HL--);
                HL &= 0xFFFF;
                return val;
            }
            default:
                console.error("Unknown register index: " + index);
        }
    }

    CPUEmulator.setIndexedPointerRegister = function(index, value){
        switch (index){
            case 0:
                memoryController.writeByte(BC, value);
                return;
            case 1:
                memoryController.writeByte(DE, value);
                return;
            case 2:
                memoryController.writeByte(HL++, value);
                HL &= 0xFFFF;
                return;
            case 3:
                memoryController.writeByte(HL--, value);
                HL &= 0xFFFF;
                return;
            default:
                console.error("Unknown register index: " + index);
        }
    }

    CPUEmulator.getIndexed16BitRegister = function(index){
        switch (index){
            case 0:
                return BC;
            case 1:
                return DE;
            case 2:
                return HL;
            case 3:
                return SP;
            default:
                console.error("Unknown register index: " + index);
        }
    }

    CPUEmulator.setIndexed16BitRegister = function(index, value){
        value &= 0xFFFF;
        switch (index){
            case 0:
                BC = value;
                break;
            case 1:
                DE = value;
                break;
            case 2:
                HL = value;
                break;
            case 3:
                SP = value;
                break;
            default:
                console.error("Unknown register index: " + index);
        }
    }

    CPUEmulator.isInDoubleSpeed = function(){
        return doubleSpeedMode;
    }

    CPUEmulator.IORegisterWritten = function(address, value) {
        switch (address){
            case 0xFF02: //serial
            {
                memoryController.writeByte(0xFF01, 0xFF,true);
                memoryController.writeByte(0xFF02, value & 0x7F,true);
                break;
            }
            case 0xFF04: //reset div
            {
                divCounter = 0;
                memoryController.writeByte(0xFF04, 0,true);
                break;
            }
            case 0xFF07: //timer control
            {
                timerEnabled = (value & 4) == 4;
                timerSpeed = timerSpeeds[value & 3];
                break;
            }
            case 0xFF4D: //prepare speed switch
            {
                if (!gbcEnabled)
                    break;
                enteringDoubleSpeedMode = (value & 1) == 1;
                memoryController.writeByte(0xFF4D, (value & 0x7F) | (doubleSpeedMode ? 0x80 : 0),true);
                break;
            }
        }

    }

    CPUEmulator.setMemoryController = function(controller){
        memoryController = controller;
    }

    CPUEmulator.checkForInterrupts = function(){
        if (!IME)
            return 0;
        var flags = memoryController.readByte(0xFF0F);
        var interrupts = flags & memoryController.readByte(0xFFFF);
        for (var i = 0; i < 5; i++){
            if ((interrupts & (1 << i)) != 0){
                call(0x40 + 8 * i);
                IME = false;
                memoryController.writeByte(0xFF0F,flags & ~(1 << i));
                suspended = false;
                return 12;
            }
        }
        return 0;
    }

    CPUEmulator.updateTimer = function(cycles){
        divCounter += cycles;
        if (divCounter >= 256){
            divCounter -= 256;
            var div = memoryController.readByte(0xFF04);
            div++;
            if (div > 255)
                div -= 256;
            memoryController.writeByte(0xFF04, div, true);
        }
        if (!timerEnabled)
            return;
        timerCounter += cycles;
        while (timerCounter >= timerSpeed){
            timerCounter -= timerSpeed;
            var timerVal = memoryController.readByte(0xFF05);
            timerVal++;
            if (timerVal > 255){
                timerVal = memoryController.readByte(0xFF06);
                this.interrupt(INT_TIMER);
            }
            memoryController.writeByte(0xFF05, timerVal, true);
        }
    }

    CPUEmulator.interrupt = function(type){
        memoryController.writeByte(0xFF0F, memoryController.readByte(0xFF0F) | (1 << type));
        if (type == INT_VBLANK)
            gameShark.applyCodes();
    }

    CPUEmulator.executeNextInstruction = function(){
        var cycles = 0;
        cycles += this.checkForInterrupts();
        if (suspended){
            return cycles + 4;
        }
        if (debug)
            console.log("0x" + PC.toString(16).toUpperCase() + " - " + this.disassemble(PC));
        var opcode = memoryController.readByte(PC);
        cycles += gameboyCPUInstruction[opcode](this);
        return cycles;
    }

    CPUEmulator.disassemble = function(address){
        var opcode = memoryController.readByte(address);
        switch (opcode){
            case 0x00: //NOP
                return "NOP";
            case 0x07: //RLCA
                return "RLCA";
            case 0x08: //LD (nnnn), SP
            {
                var location = memoryController.readWord(address+1);
                return "LD (0x" + location.toString(16).toUpperCase() + "), SP";
            }
            case 0x0F: //RRCA
                return "RRCA";
            case 0x10: //STOP
                return "STOP";
            case 0x17: //RLA
                return "RLA";
            case 0x18: //JR nn
            {
                var pos = memoryController.readSignedByte(address+1);
                return "JR 0x" + (address + 2 +pos).toString(16).toUpperCase();
            }
            case 0x1F: //RRA
                return "RRA";
            case 0x20: //JR NZ, nn
            {
                var pos = memoryController.readSignedByte(address+1);
                return "JR NZ, 0x" + (address + 2 + pos).toString(16).toUpperCase();
            }
            case 0x27: //DAA
                return "DAA";
            case 0x28: //JR Z,nn
            {
                var pos = memoryController.readSignedByte(address+1);
                return "JR Z, 0x" + (address + 2 + pos).toString(16).toUpperCase();
            }
            case 0x2F: //CPL
                return "CPL";
            case 0x30: //JR NC, nn
            {
                var pos = memoryController.readSignedByte(address+1);
                return "JR NC, 0x" + (address + 2 + pos).toString(16).toUpperCase();
            }
            case 0x37: //SCF
                return "SCF";
            case 0x38: //JR C,nn
            {
                var pos = memoryController.readSignedByte(address+1);
                return "JR C, 0x" + (address + 2 + pos).toString(16).toUpperCase();
            }
            case 0x3F://CCF
                return "CCF";
            case 0x76: //HALT
                return "HALT";
            case 0xC0: //RET NZ
                return "RET NZ";
            case 0xC2: //JP NZ, nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "JP NZ, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xC3: //JP NNNN
            {
                var pos = memoryController.readWord(address + 1);
                return "JP 0x" + pos.toString(16).toUpperCase();
            }
            case 0xC4: //CALL NZ nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "CALL NZ, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xC6: //ADD A, nn
            {
                var data = memoryController.readByte(address + 1);
                return "ADD A, 0x" + data.toString(16).toUpperCase();
            }
            case 0xC7: //RST 0x00
                return "RST 0x00";
            case 0xC8: //RET Z
                return "RET Z";
            case 0xC9: //RET
                return "RET";
            case 0xCA: //JP Z, nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "JP Z, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xCB: //bitshift / test
            {
                opcode = memoryController.readByte(address + 1);
                if (opcode >= 0xC0){ //SET
                    var num = (opcode - 0xC0) / 0x08;
                    var registerIndex = opcode - 0xC0 - num * 0x08;
                    return "SET " + num + ", " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x80){ //RES
                    var num = (opcode - 0x80) / 0x08;
                    var registerIndex = opcode - 0x80 - num * 0x08;
                    return "RES " + num + ", " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x40){//BIT
                    var num = (opcode - 0x40) / 0x08;
                    var registerIndex = opcode - 0x40 - num * 0x08;
                    return "BIT " + num + ", " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x38){//SRL
                    var registerIndex = opcode - 0x38;
                    return "SRL " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x30){//SWAP
                    var registerIndex = opcode - 0x30;
                    return "SWAP " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x28){// SRA
                    var registerIndex = opcode - 0x28;
                    return "SRA " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x20){// SLA
                    var registerIndex = opcode - 0x20;
                    return "SLA " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x18){// RR
                    var registerIndex = opcode - 0x18;
                    return "RR " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x10){// RL
                    var registerIndex = opcode - 0x10;
                    return "RL " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x08){// RRC
                    var registerIndex = opcode - 0x08;
                    return "RRC " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else{// RLC
                    var registerIndex = opcode;
                    return "RLC " + this.getIndexed8BitRegisterName(registerIndex);
                }
            }
            case 0xCC: //CALL Z nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "CALL Z, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xCD: //CALL nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "CALL 0x" + pos.toString(16).toUpperCase();
            }
            case 0xCE: //ADC A, nn
            {
                var data = memoryController.readByte(address + 1);
                return "ADC A, 0x" + data.toString(16).toUpperCase();
            }
            case 0xCF: //RST 0x08
                return "RST 0x08";
            case 0xD0: //RET NC
                return "RET NC";
            case 0xD2: //JP NC, nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "JP NC, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xD4: //CALL NC nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "CALL NC, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xD6: //SUB A, nn
            {
                var data = memoryController.readByte(address + 1);
                return "SUB A, 0x" + data.toString(16).toUpperCase();
            }
            case 0xD7: //RST 0x10
                return "RST 0x10";
            case 0xD8: //RET C
                return "RET C";
            case 0xD9: //RETI
                return "RETI";
            case 0xDA: //JP C,nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "JP C, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xDC: //CALL C nnnn
            {
                var pos = memoryController.readWord(address + 1);
                return "CALL C, 0x" + pos.toString(16).toUpperCase();
            }
            case 0xDE: //SBC A, nn
            {
                var data = memoryController.readByte(PC + 1);
                return "SBC A, 0x" + data.toString(16).toUpperCase();
            }
            case 0xDF: //RST 0x18
                return "RST 0x18";
            case 0xE0: //LDH (nn),A
            {
                var pos = memoryController.readByte(address+1) | 0xFF00;
                return "LD (0x" + pos.toString(16).toUpperCase() +"), A";
            }
            case 0xE2: //LD (C), A
                return "LD (C), A";
            case 0xE6: //AND A, nn
            {
                var value = memoryController.readByte(address+1);
                return "AND A, 0x" + value.toString(16).toUpperCase();
            }
            case 0xE7: //RST 0x20
                return "RST 0x20";
            case 0xE8: //ADD SP,nn
            {
                var val = memoryController.readSignedByte(address+1);
                if (val < 0){
                    return "ADD SP, -0x" + (-val).toString(16).toUpperCase();
                }
                else{
                    return "ADD SP, 0x" + val.toString(16).toUpperCase();
                }
            }
            case 0xE9: //JP HL
                return "JP HL";
            case 0xEA: //LD (nnnn),A
            {
                var pos = memoryController.readWord(address+1);
                return "LD (0x" + pos.toString(16).toUpperCase() +"), A";
            }
            case 0xEE: //XOR a, nn
            {
                var data = memoryController.readByte(address+1);
                return "XOR A, 0x" + data.toString(16).toUpperCase();
            }
            case 0xEF: //RST 0x28
                return "RST 0x28";
            case 0xF0: //LDH A,(nn)
            {
                var pos = memoryController.readByte(address+1)| 0xFF00;
                return "LD A, (0x" + pos.toString(16).toUpperCase() + ")";
            }
            case 0xF2: //LD A, (C)
                return "LD A, (C)";
            case 0xF3: //DI
                return "DI";
            case 0xF6: //OR A, nn
            {
                var value = memoryController.readByte(address+1);
                return "OR A, 0x" + value.toString(16).toUpperCase();
            }
            case 0xF7: //RST 0x30
                return "RST 0x30";
            case 0xF8: //LD HL, SP+nn
            {
                var val = memoryController.readSignedByte(address + 1);
                if (val < 0)
                    return "LD HL, SP + -0x" + (-val).toString(16).toUpperCase();
                else
                    return "LD HL, SP + 0x" + val.toString(16).toUpperCase();
            }
            case 0xF9: //LD SP, HL
                return "LD SP, HL";
            case 0xFA: //LD A, (nnnn)
            {
                var position = memoryController.readWord(address+1);
                return "LD A, (0x" + position.toString(16).toUpperCase() + ")";
            }
            case 0xFB: //EI
                return "EI";
            case 0xFE: //CP A, NN
            {
                var value = memoryController.readByte(address+1);
                return "CP A, 0x" + value.toString(16).toUpperCase();
            }
            case 0xFF: //RST 0x38
                return "RST 0x38";
            default:
            {
                if (opcode <= 0x3F){
                    if ((opcode & 0x0F) == 0x01){ //LD 16bitreg, nnnn
                        var reg = Math.floor(opcode / 0x10);
                        var val = memoryController.readWord(address + 1);
                        return "LD " + this.getIndexed16BitRegisterName(reg) + ", 0x" + val.toString(16).toUpperCase();
                    }
                    else if ((opcode & 0x0F) == 0x02){ //LD pointer reg, A
                        var reg = Math.floor(opcode / 0x10);
                        return "LD " + this.getIndexedPointerRegisterName(reg) + ", A";
                    }
                    else if ((opcode & 0x0F) == 0x03){ //INC 16bit register
                        var reg = Math.floor(opcode / 0x10);
                        return "INC " + this.getIndexed16BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x04){ //INC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2;
                        return "INC " + this.getIndexed8BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x05){ //DEC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2;
                        return "DEC " + this.getIndexed8BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x06){//LD 8bitreg, nn
                        var reg = Math.floor(opcode / 0x10) * 2;
                        var val = memoryController.readByte(PC + 1);
                        return "LD " + this.getIndexed8BitRegisterName(reg) + ", 0x" + val.toString(16).toUpperCase();
                    }
                    else if ((opcode & 0x0F) == 0x09){ //ADD HL, 16bitreg
                        var reg = Math.floor(opcode / 0x10);
                        return "ADD HL, " + this.getIndexed16BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x0A){ //LD A, pointer register
                        var reg = Math.floor(opcode / 0x10);
                        return "LD A, " + this.getIndexedPointerRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x0B){ //DEC 16bit register
                        var reg = Math.floor(opcode / 0x10);
                        return "DEC " + this.getIndexed16BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x0C){ //INC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2 + 1;
                        return "INC " + this.getIndexed8BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x0D){ //DEC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2 + 1;
                        return "DEC " + this.getIndexed8BitRegisterName(reg);
                    }
                    else if ((opcode & 0x0F) == 0x0E){ //LD 8bitreg, nn
                        var reg = Math.floor(opcode / 0x10) * 2 + 1;
                        var val = memoryController.readByte(address + 1);
                        return "LD " + this.getIndexed8BitRegisterName(reg) + ", 0x" + val.toString(16).toUpperCase();
                    }
                }
                else if (opcode >= 0xC0){
                    if ((opcode & 0x0F) == 0x01){//pop 16 bit register
                        var reg = Math.floor((opcode - 0xC0) / 0x10);
                        if (reg == 3){
                            return "POP AF";
                        }
                        else{
                            return "POP " + this.getIndexed16BitRegisterName(reg);
                        }
                    }
                    else if ((opcode & 0x0F) == 0x05){//push 16 bit register
                        var reg = Math.floor((opcode - 0xC0) / 0x10);
                        if (reg == 3){
                            return "PUSH AF";
                        }
                        else{
                            return "PUSH " + this.getIndexed16BitRegisterName(reg);
                        }
                    }
                }
                else if (opcode >= 0x40 && opcode <= 0x7F && opcode != 0x76){//LD 8bitregister, 8bitregister
                    var reg1 = Math.floor((opcode - 0x40) / 0x08);
                    var reg2 = opcode - 0x40 - reg1 * 0x08;
                    return "LD " + this.getIndexed8BitRegisterName(reg1) + ", " + this.getIndexed8BitRegisterName(reg2);
                }
                else if (opcode >= 0x80 && opcode <= 0x87){ //ADD A, 8bit register
                    var registerIndex = opcode - 0x80;
                    return "ADD A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x88 && opcode <= 0x8F){ //ADC A, 8bit register
                    var registerIndex = opcode - 0x88;
                    return "ADD A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x90 && opcode <= 0x97){ //SUB A, 8bit register
                    var registerIndex = opcode - 0x90;
                    return "SUB A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0x98 && opcode <= 0x9F){ //SBC A, 8bit register
                    var registerIndex = opcode - 0x98;
                    return "SBC A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0xA0 && opcode <= 0xA7){ //AND A, 8bit register
                    var registerIndex = opcode - 0xA0;
                    return "AND A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0xA8 && opcode <= 0xAF){ //XOR A, 8bit register
                    var registerIndex = opcode - 0xA8;
                    return "XOR A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0xB0 && opcode <= 0xB7){ //OR A, 8bit register
                    var registerIndex = opcode - 0xB0;
                    return "OR A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
                else if (opcode >= 0xB8 && opcode <= 0xBF){ //CP A, 8bit register
                    var registerIndex = opcode - 0xB8;
                    return  "CP A, " + this.getIndexed8BitRegisterName(registerIndex);
                }
            }
        }
        return "INVALID INSTRUCTION";
    }

    CPUEmulator.takeStep = function(){
        var cycles = this.executeNextInstruction();
        this.updateTimer(cycles);
        return cycles;
    }

    CPUEmulator.reset = function(){
        AF = 0;
        BC = 0;
        DE = 0;
        HL = 0;
        PC = 0;
        SP = 0;
        IME = false;
        divCounter = 0;
        timerCounter = 0;
        timerSpeed = timerSpeeds[0];
        timerEnabled = false;
        suspended = false;
        doubleSpeedMode = false;
        enteringDoubleSpeedMode = false;
    }

    CPUEmulator.simulateBIOS = function(){
        memoryController.writeByte(0xFF40,0x91);
        AF = 0x01B0;
        BC = 0x0113;//BC=0x0013 would be GBC, this emulates GBC mode on a GBA
        DE = 0x00D8;
        HL = 0x014D;
        SP = 0xFFFE;
        if (gbcEnabled)
            this.setA(0x11);
        memoryController.writeByte(0xFF50,1);
        PC = 0x0100;
        memoryController.writeByte(0xFF10,0x80);
        memoryController.writeByte(0xFF11,0xBF);
        memoryController.writeByte(0xFF12,0xF3);
        memoryController.writeByte(0xFF14,0xBF);
        memoryController.writeByte(0xFF16,0x3F);
        memoryController.writeByte(0xFF17,0x00);
        memoryController.writeByte(0xFF19,0xBF);
        memoryController.writeByte(0xFF1A,0x7F);
        memoryController.writeByte(0xFF1B,0xFF);
        memoryController.writeByte(0xFF1C,0x9F);
        memoryController.writeByte(0xFF1E,0xBF);
        memoryController.writeByte(0xFF20,0xFF);
        memoryController.writeByte(0xFF21,0x00);
        memoryController.writeByte(0xFF22,0x00);
        memoryController.writeByte(0xFF23,0xBF);
        memoryController.writeByte(0xFF24,0x77);
        memoryController.writeByte(0xFF25,0xF3);
        memoryController.writeByte(0xFF26,0xF1);
    }

    var SingleByteRegisterNames = ["B","C","D","E","H","L","(HL)","A"];
    var DoubleByteRegisterNames = ["BC","DE","HL","SP"];
    var PointerRegisterNames = ["(BC)","(DE)","(HL+)","(HL-)"];

    CPUEmulator.getIndexedPointerRegisterName = function(index){
        return PointerRegisterNames[index];
    }

    CPUEmulator.getIndexed16BitRegisterName = function(index){
        return DoubleByteRegisterNames[index];
    }

    CPUEmulator.getIndexed8BitRegisterName = function(index){
        return SingleByteRegisterNames[index];
    }

    var gameboyCPUInstruction = [
        function (parent){//0x00: NOP
            PC++;
            return 4;
        },
        function (parent){//0x01: LD BC, nnnn
            BC = memoryController.readWord(PC + 1);
            PC += 3;
            return 12;
        },
        function (parent){//0x02: LD (BC), A
            memoryController.writeByte(BC,parent.getA());
            PC += 1;
            return 8;
        },
        function (parent){//0x03: INC BC
            BC++;
            BC &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x04: INC B
            var data = parent.getB() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setB(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x05: DEC B
            var data = parent.getB() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setB(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x06: LD B, nn
            parent.setB(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function (parent){//0x07: RLCA
            PC++;
            var data = parent.getA();
            parent.setCarry((data & 0x80) != 0);
            parent.setA((data << 1) | (data >> 7));
            parent.setZero(false);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            return 4;
        },
        function (parent){//0x08: LD (nnnn), SP
            var location = memoryController.readWord(PC+1);
            memoryController.writeWord(location,SP);
            PC += 3;
            return 20;
        },
        function (parent){//0x09: ADD HL, BC
            var data = (BC + HL) & 0xFFFF;
            parent.setHalfCarry(((HL^BC^data) & 0x1000) != 0);
            parent.setCarry(((HL + BC) & 0x10000) != 0);
            parent.setSubtract(false);
            HL = data;
            PC += 1;
            return 8;
        },
        function (parent){//0x0A: LD A, (BC)
            parent.setA(memoryController.readByte(BC));
            DE &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x0B: DEC BC
            BC--;
            BC &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x0C: INC C
            var data = parent.getC() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setC(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x0D: DEC C
            var data = parent.getC() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setC(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x0E: LD C, nn
            parent.setC(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function(parent){//0x0F: RRCA
            var a = parent.getA();
            parent.setCarry((a & 0x01) != 0);
            a >>= 1;
            if (parent.getCarry())
                a |= 0x80;
            parent.setA(a);
            parent.setZero(false);
            parent.setHalfCarry(false);
            parent.setSubtract(false);
            PC += 1;
            return 4;
        },
        function(parent){//0x10: STOP
            if (gbcEnabled){
                doubleSpeedMode = enteringDoubleSpeedMode;
                memoryController.writeByte(0xFF4D, (memoryController.readByte(0xFF4D) & 0x7F) | (doubleSpeedMode ? 0x80 : 0),true);
            }
            else{
                IME = true;
                suspended = true;
            }
            PC += 2;
            return 4;
        },
        function (parent){ //0x11: LD DE, nnnn
            DE = memoryController.readWord(PC + 1);
            PC += 3;
            return 12;
        },
        function (parent){//0x12: LD (DE), A
            memoryController.writeByte(DE,parent.getA());
            PC += 1;
            return 8;
        },
        function (parent){//0x13: DE++
            DE++;
            DE &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x14: INC D
            var data = parent.getD() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setD(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x15: DEC D
            var data = parent.getD() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setD(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x16: LD D, nn
            parent.setD(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function (parent){//0x17: RLA
            var data = parent.getA();
            data <<= 1;
            if (parent.getCarry())
                data |= 1;
            data &= 0xFF;
            parent.setCarry((parent.getA() & 0x80) != 0);
            parent.setZero(false);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setA(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x18: JR nn
            var pos = memoryController.readSignedByte(PC+1);
            PC += pos + 2;
            return 12;
        },
        function (parent){//0x19: ADD HL, DE
            var data = (DE + HL) & 0xFFFF;
            parent.setHalfCarry(((HL^DE^data) & 0x1000) != 0);
            parent.setCarry(((HL + DE) & 0x10000) != 0);
            parent.setSubtract(false);
            HL = data;
            PC += 1;
            return 8;
        },
        function (parent){//0x1A: LD A, (DE)
            parent.setA(memoryController.readByte(DE));
            DE &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x1B: DEC DE
            DE--;
            DE &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x1C: INC E
            var data = parent.getE() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setE(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x1D: DEC E
            var data = parent.getE() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setE(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x0E: LD E, nn
            parent.setE(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function (parent){//0x1F: RRA
            var a = parent.getA();
            a = (a >> 1) | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((parent.getA() & 1) != 0);
            parent.setA(a);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(false);
            PC += 1;
            return 4;
        },
        function (parent){//0x20: JR NZ, nn
            var pos = memoryController.readSignedByte(PC+1);
            if (!parent.getZero()){
                PC += pos + 2;
                return 12;
            }
            else{
                PC += 2;
                return 8;
            }
        },
        function (parent){ //0x21: LD HL, nnnn
            HL = memoryController.readWord(PC + 1);
            PC += 3;
            return 12;
        },
        function (parent){//0x22: LD (HL++), A
            memoryController.writeByte(HL++,parent.getA());
            HL &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x23: HL++
            HL++;
            HL &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x24: INC H
            var data = parent.getH() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setH(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x25: DEC H
            var data = parent.getH() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setH(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x26: LD H, nn
            parent.setH(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function(parent){//0x27: DAA
            var a = parent.getA();

            if (!parent.getSubtract()){
                if (parent.getHalfCarry() || (a & 0x0F) > 9)
                    a += 6;
                if (parent.getCarry() || a > 0x9F)
                    a += 0x60;
            }
            else{
                if (parent.getHalfCarry()){
                    a -= 6;
                    a &= 0xFF;
                }
                if (parent.getCarry())
                    a -= 0x60;
            }

            parent.setHalfCarry(false);

            if ((a & 0x100) == 0x100)
                parent.setCarry(true);

            parent.setA(a);
            parent.setZero(parent.getA() == 0);

            PC += 1;
            return 4;
        },
        function(parent){//0x28: JR Z, nn
            var pos = memoryController.readSignedByte(PC+1);
            if (parent.getZero()){
                PC += pos + 2;
                return 12;
            }
            else{
                PC += 2;
                return 8;
            }
        },
        function (parent){//0x29: ADD HL, HL
            var data = (HL << 1) & 0xFFFF;
            parent.setHalfCarry((data & 0x1000) != 0);
            parent.setCarry((HL & 0x8000) != 0);
            parent.setSubtract(false);
            HL = data;
            PC += 1;
            return 8;
        },
        function (parent){//0x2A: LD A, (HL++)
            parent.setA(memoryController.readByte(HL++));
            HL &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x2B: DEC HL
            HL--;
            HL &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x2C: INC L
            var data = parent.getL() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setL(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x2D: DEC L
            var data = parent.getL() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setL(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x2E: LD L, nn
            parent.setL(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function (parent){//0x2F: CPL
            parent.setA(parent.getA() ^ 255);
            parent.setHalfCarry(true);
            parent.setSubtract(true);
            PC += 1;
            return 4;
        },
        function (parent){//0x30: JR NC, nn
            var pos = memoryController.readSignedByte(PC+1);
            if (!parent.getCarry()){
                PC += pos + 2;
                return 12;
            }
            else{
                PC += 2;
                return 8;
            }
        },
        function (parent){ //0x31: LD SP, nnnn
            SP = memoryController.readWord(PC + 1);
            PC += 3;
            return 12;
        },
        function (parent){//0x32: LD (HL--), A
            memoryController.writeByte(HL--,parent.getA());
            HL &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x33: SP++
            SP++;
            SP &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x34: INC (HL)
            var data = memoryController.readByte(HL) + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            memoryController.writeByte(HL,data);
            PC += 1;
            return 12;
        },
        function (parent){//0x35: DEC (HL)
            var data = memoryController.readByte(HL) - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            memoryController.writeByte(HL,data);
            PC += 1;
            return 12;
        },
        function (parent){//0x36: LD (HL), nn
            memoryController.writeByte(HL,memoryController.readByte(PC + 1));
            PC += 2;
            return 12;
        },
        function (parent){//0x37: SCF
            parent.setCarry(true);
            parent.setHalfCarry(false);
            parent.setSubtract(false);
            PC += 1;
            return 4;
        },
        function (parent){//0x38: JR C, nn
            var pos = memoryController.readSignedByte(PC+1);
            if (parent.getCarry()){
                PC += pos + 2;
                return 12;
            }
            else{
                PC += 2;
                return 8;
            }
        },
        function (parent){//0x39: ADD HL, SP
            var data = (SP + HL) & 0xFFFF;
            parent.setHalfCarry(((HL^SP^data) & 0x1000) != 0);
            parent.setCarry(((HL + SP) & 0x10000) != 0);
            parent.setSubtract(false);
            HL = data;
            PC += 1;
            return 8;
        },
        function (parent){//0x3A: LD A, (HL--)
            parent.setA(memoryController.readByte(HL--));
            HL &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x3B: DEC SP
            SP--;
            SP &= 0xFFFF;
            PC += 1;
            return 8;
        },
        function (parent){//0x3C: INC A
            var data = parent.getA() + 1;
            data &= 0xFF;
            parent.setSubtract(false);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0);
            parent.setA(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x2D: DEC A
            var data = parent.getA() - 1;
            data &= 0xFF;
            parent.setSubtract(true);
            parent.setZero(data == 0);
            parent.setHalfCarry((data & 0x0F) == 0x0F);
            parent.setA(data);
            PC += 1;
            return 4;
        },
        function (parent){//0x3E: LD A, nn
            parent.setA(memoryController.readByte(PC + 1));
            PC += 2;
            return 8;
        },
        function (parent){//0x3F: CCF
            parent.setCarry(!parent.getCarry());
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function(parent){//0x40: LD B,B
            PC += 1;
            return 4;
        },
        function(parent){//0x41: LD B,C
            parent.setB(parent.getC());
            PC += 1;
            return 4;
        },
        function(parent){//0x42: LD B,D
            parent.setB(parent.getD());
            PC += 1;
            return 4;
        },
        function(parent){//0x43: LD B,E
            parent.setB(parent.getE());
            PC += 1;
            return 4;
        },
        function(parent){//0x44: LD B,H
            parent.setB(parent.getH());
            PC += 1;
            return 4;
        },
        function(parent){//0x45: LD B,L
            parent.setB(parent.getL());
            PC += 1;
            return 4;
        },
        function(parent){//0x46: LD B,(HL)
            parent.setB(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x47: LD B,A
            parent.setB(parent.getA());
            PC += 1;
            return 4;
        },
        function(parent){//0x48: LD C,B
            parent.setC(parent.getB());
            PC += 1;
            return 4;
        },
        function(parent){//0x49: LD C,C
            PC += 1;
            return 4;
        },
        function(parent){//0x4A: LD C,D
            parent.setC(parent.getD());
            PC += 1;
            return 4;
        },
        function(parent){//0x4B: LD C,E
            parent.setC(parent.getE());
            PC += 1;
            return 4;
        },
        function(parent){//0x4C: LD C,H
            parent.setC(parent.getH());
            PC += 1;
            return 4;
        },
        function(parent){//0x4D: LD C,L
            parent.setC(parent.getL());
            PC += 1;
            return 4;
        },
        function(parent){//0x4E: LD C,(HL)
            parent.setC(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x4F: LD C,A
            parent.setC(parent.getA());
            PC += 1;
            return 4;
        },
        function(parent){//0x50: LD D,B
            parent.setD(parent.getB());
            PC += 1;
            return 4;
        },
        function(parent){//0x51: LD D,C
            parent.setD(parent.getC());
            PC += 1;
            return 4;
        },
        function(parent){//0x52: LD D,D
            PC += 1;
            return 4;
        },
        function(parent){//0x53: LD D,E
            parent.setD(parent.getE());
            PC += 1;
            return 4;
        },
        function(parent){//0x54: LD D,H
            parent.setD(parent.getH());
            PC += 1;
            return 4;
        },
        function(parent){//0x55: LD D,L
            parent.setD(parent.getL());
            PC += 1;
            return 4;
        },
        function(parent){//0x56: LD D,(HL)
            parent.setD(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x57: LD D,A
            parent.setD(parent.getA());
            PC += 1;
            return 4;
        },
        function(parent){//0x58: LD E,B
            parent.setE(parent.getB());
            PC += 1;
            return 4;
        },
        function(parent){//0x59: LD E,C
            parent.setE(parent.getC());
            PC += 1;
            return 4;
        },
        function(parent){//0x5A: LD E,D
            parent.setE(parent.getD());
            PC += 1;
            return 4;
        },
        function(parent){//0x5B: LD E,E
            PC += 1;
            return 4;
        },
        function(parent){//0x5C: LD E,H
            parent.setE(parent.getH());
            PC += 1;
            return 4;
        },
        function(parent){//0x5D: LD E,L
            parent.setE(parent.getL());
            PC += 1;
            return 4;
        },
        function(parent){//0x5E: LD E,(HL)
            parent.setE(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x5F: LD E,A
            parent.setE(parent.getA());
            PC += 1;
            return 4;
        },
        function(parent){//0x60: LD H,B
            parent.setH(parent.getB());
            PC += 1;
            return 4;
        },
        function(parent){//0x61: LD H,C
            parent.setH(parent.getC());
            PC += 1;
            return 4;
        },
        function(parent){//0x62: LD H,D
            parent.setH(parent.getD());
            PC += 1;
            return 4;
        },
        function(parent){//0x63: LD H,E
            parent.setH(parent.getE());
            PC += 1;
            return 4;
        },
        function(parent){//0x64: LD H,H
            PC += 1;
            return 4;
        },
        function(parent){//0x65: LD H,L
            parent.setH(parent.getL());
            PC += 1;
            return 4;
        },
        function(parent){//0x56: LD H,(HL)
            parent.setH(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x67: LD H,A
            parent.setH(parent.getA());
            PC += 1;
            return 4;
        },
        function(parent){//0x68: LD L,B
            parent.setL(parent.getB());
            PC += 1;
            return 4;
        },
        function(parent){//0x69: LD L,C
            parent.setL(parent.getC());
            PC += 1;
            return 4;
        },
        function(parent){//0x6A: LD L,D
            parent.setL(parent.getD());
            PC += 1;
            return 4;
        },
        function(parent){//0x6B: LD L,E
            parent.setL(parent.getE());
            PC += 1;
            return 4;
        },
        function(parent){//0x6C: LD L,H
            parent.setL(parent.getH());
            PC += 1;
            return 4;
        },
        function(parent){//0x6D: LD L,L
            PC += 1;
            return 4;
        },
        function(parent){//0x6E: LD L,(HL)
            parent.setL(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x6F: LD L,A
            parent.setL(parent.getA());
            PC += 1;
            return 4;
        },
        function(parent){//0x70: LD (HL),B
            memoryController.writeByte(HL,parent.getB());
            PC += 1;
            return 8;
        },
        function(parent){//0x71: LD (HL),C
            memoryController.writeByte(HL,parent.getC());
            PC += 1;
            return 8;
        },
        function(parent){//0x72: LD (HL),D
            memoryController.writeByte(HL,parent.getD());
            PC += 1;
            return 8;
        },
        function(parent){//0x73: LD (HL),E
            memoryController.writeByte(HL,parent.getE());
            PC += 1;
            return 8;
        },
        function(parent){//0x74: LD (HL),H
            memoryController.writeByte(HL,parent.getH());
            PC += 1;
            return 8;
        },
        function(parent){//0x75: LD (HL),L
            memoryController.writeByte(HL,parent.getL());
            PC += 1;
            return 8;
        },
        function (parent){//0x76: HALT
            IME = true;
            suspended = true;
            PC += 1;
            return 4;
        },
        function(parent){//0x77: LD (HL),A
            memoryController.writeByte(HL,parent.getA());
            PC += 1;
            return 8;
        },
        function(parent){//0x78: LD A,B
            parent.setA(parent.getB());
            PC += 1;
            return 4;
        },
        function(parent){//0x79: LD A,C
            parent.setA(parent.getC());
            PC += 1;
            return 4;
        },
        function(parent){//0x7A: LD A,D
            parent.setA(parent.getD());
            PC += 1;
            return 4;
        },
        function(parent){//0x7B: LD A,E
            parent.setA(parent.getE());
            PC += 1;
            return 4;
        },
        function(parent){//0x7C: LD A,H
            parent.setA(parent.getH());
            PC += 1;
            return 4;
        },
        function(parent){//0x7D: LD A,L
            parent.setA(parent.getL());
            PC += 1;
            return 4;
        },
        function(parent){//0x7E: LD A,(HL)
            parent.setA(memoryController.readByte(HL));
            PC += 1;
            return 8;
        },
        function(parent){//0x6F: LD A,A
            PC += 1;
            return 4;
        },
        function (parent){//0x80: ADD A,B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x81: ADD A,C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x82: ADD A,D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x83: ADD A,E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x84: ADD A,H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x85: ADD A,L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x86: ADD A,(HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a + oValue;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 8;
        },
        function (parent){//0x87: ADD A,A
            var a = parent.getA();
            var value = a << 1;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry((value & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x88: ADC A,B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x89: ADC A,C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x8A: ADC A,D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x8B: ADC A,E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x8C: ADC A,H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x8D: ADC A,L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x8E: ADC A,(HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a + oValue + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 8;
        },
        function (parent){//0x8F: ADC A,A
            var a = parent.getA();
            var value = (a << 1) + (parent.getCarry() ? 1:0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry((value & 0x10) != 0);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x90: SUB A,B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x91: SUB A,C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x92: SUB A,D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x93: SUB A,E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x94: SUB A,H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x95: SUB A,L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x96: SUB A,(HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a - oValue;
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 8;
        },
        function (parent){//0x97: SUB A,A
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setSubtract(true);
            parent.setA(0);
            parent.setZero(true);
            PC += 1;
            return 4;
        },
        function (parent){//0x98: SBC A, B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x99: SBC A, C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x9A: SBC A, D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x9B: SBC A, E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x9C: SBC A, H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x9D: SBC A, L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 4;
        },
        function (parent){//0x9E: SBC A, (HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a - oValue - (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0xFF00) != 0);
            value &= 0xFF;
            parent.setHalfCarry(((a^oValue^value) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(value == 0);
            PC += 1;
            return 8;
        },
        function (parent){//0x9F: SBC A, A
            var carry = parent.getCarry();
            parent.setHalfCarry(carry);
            parent.setSubtract(true);
            parent.setA(carry ? 0xFF : 0);
            parent.setZero(!carry);
            PC += 1;
            return 4;
        },
        function (parent){//0xA0: AND A, B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA1: AND A, C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA2: AND A, D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA3: AND A, E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA4: AND A, H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA5: AND A, L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA6: AND A, (HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a & oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 8;
        },
        function (parent){//0xA7: AND A, A
            parent.setZero(parent.getA() == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(true);
            PC += 1;
            return 4;
        },
        function (parent){//0xA8: XOR A, B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xA9: XOR A, C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xAA: XOR A, D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xAB: XOR A, E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xAC: XOR A, H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xAD: XOR A, L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xAE: XOR A, (HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a ^ oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 8;
        },
        function (parent){//0xAF: XOR A, A
            parent.setA(0);
            parent.setZero(true);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB0: OR A, B
            var oValue = parent.getB();
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB1: OR A, C
            var oValue = parent.getC();
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB2: OR A, D
            var oValue = parent.getD();
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB3: OR A, E
            var oValue = parent.getE();
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB4: OR A, H
            var oValue = parent.getH();
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB5: OR A, L
            var oValue = parent.getL();
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB6: OR A, (HL)
            var oValue = memoryController.readByte(HL);
            var a = parent.getA();
            var value = a | oValue;
            parent.setA(value);
            parent.setZero(value == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 8;
        },
        function (parent){//0xB7: OR A, A
            parent.setZero(parent.getA() == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xB8: CP A, B
            var value = parent.getB();
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 4;
        },
        function (parent){//0xB9: CP A, C
            var value = parent.getC();
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 4;
        },
        function (parent){//0xBA: CP A, D
            var value = parent.getD();
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 4;
        },
        function (parent){//0xBB: CP A, E
            var value = parent.getE();
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 4;
        },
        function (parent){//0xBC: CP A, H
            var value = parent.getH();
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 4;
        },
        function (parent){//0xBD: CP A, L
            var value = parent.getL();
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 4;
        },
        function (parent){//0xB8: CP A, (HL)
            var value = memoryController.readByte(HL);
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 1;
            return 8;
        },
        function (parent){//0xB8: CP A, A
            parent.setSubtract(true);
            parent.setZero(true);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 1;
            return 4;
        },
        function (parent){//0xC0: RET NZ
            if (!parent.getZero()){
                ret();
                return 20;
            }
            else{
                PC += 1;
                return 8;
            }
        },
        function (parent){//0xC1: POP BC
            BC = memoryController.readWord(SP);
            SP += 2;
            SP &= 0xFFFF;
            PC += 1;
            return 12;
        },
        function (parent){//0xC2: JP NZ, nnnn
            var pos = memoryController.readWord(PC + 1);
            if (!parent.getZero()){
                PC = pos;
                return 16;
            }
            else{
                PC += 3;
                return 12;
            }
        },
        function (parent){//0xC3: JP NNNN
            PC = memoryController.readWord(PC + 1);
            return 16;
        },
        function (parent){//0xC4: CALL NZ nnnn
            var pos = memoryController.readWord(PC + 1);
            PC += 3;
            if (!parent.getZero()){
                call(pos);
                return 24;
            }
            else{
                return 12;
            }
        },
        function (parent){//0xC5: PUSH BC
            SP -= 2;
            SP &= 0xFFFF;
            memoryController.writeWord(SP,BC);
            PC += 1;
            return 16;
        },
        function (parent){//0xC6: ADD A, nn
            var data = memoryController.readByte(PC + 1);
            var a = parent.getA();
            parent.setHalfCarry((((a & 0x0F) + (data & 0x0F)) & 0xF0) != 0);
            var value = a + data;
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            parent.setA(value);
            parent.setZero(parent.getA() == 0);
            PC += 2;
            return 8;
        },
        function (parent){//0xC7: RST 0x00
            PC += 1;
            call(0x00);
            return 16;
        },
        function (parent){//0xC8: RET Z
            if (parent.getZero()){
                ret();
                return 20;
            }
            else{
                PC += 1;
                return 8;
            }
        },
        function (parent){//0xC9
            ret();
            return 16;
        },
        function (parent){//0xCA
            var pos = memoryController.readWord(PC + 1);
            if (parent.getZero()){
                PC = pos;
                return 16;
            }
            else{
                PC += 3;
                return 12;
            }
        },
        function (parent){//0xCB: bitshift/test op
            var subOp = memoryController.readByte(PC+1);
            PC++;
            return cbInstruction[memoryController.readByte(PC++)](parent);
        },
        function (parent){//0xCC: CALL Z nnnn
            var pos = memoryController.readWord(PC + 1);
            PC += 3;
            if (parent.getZero()){
                call(pos);
                return 24;
            }
            else{
                return 12;
            }
        },
        function (parent){//0xCD: CALL nnnn
            var pos = memoryController.readWord(PC + 1);
            PC += 3;
            call(pos);
            return 24;
        },
        function (parent){//0xCE: ADC A, nn
            var value = parent.getA() + memoryController.readByte(PC + 1) + (parent.getCarry() ? 1:0);
            parent.setHalfCarry(((parent.getA()^memoryController.readByte(PC + 1)^(value & 0xFF)) & 0x10) != 0);
            parent.setSubtract(false);
            parent.setCarry((value & 0xFF00) != 0);
            parent.setA(value);
            parent.setZero(parent.getA() == 0);
            PC += 2;
            return 8;
        },
        function (parent){//0xCF: RST 0x08
            PC += 1;
            call(0x08);
            return 16;
        },
        function(parent){//0xD0: RET NC
            if (!parent.getCarry()){
                ret();
                return 20;
            }
            else{
                PC += 1;
                return 8;
            }
        },
        function (parent){//0xD1: POP DE
            DE = memoryController.readWord(SP);
            SP += 2;
            SP &= 0xFFFF;
            PC += 1;
            return 12;
        },
        function (parent){//0xD2: JP NC, nnnn
            var pos = memoryController.readWord(PC + 1);
            if (!parent.getCarry()){
                PC = pos;
                return 16;
            }
            else{
                PC += 3;
                return 12;
            }
        },
        instructionErrorVector,//0xD3
        function (parent){//0xD4: CALL NC nnnn
            var pos = memoryController.readWord(PC + 1);
            PC += 3;
            if (!parent.getCarry()){
                call(pos);
                return 24;
            }
            else{
                return 12;
            }
        },
        function (parent){//0xD5: PUSH DE
            SP -= 2;
            SP &= 0xFFFF;
            memoryController.writeWord(SP,DE);
            PC += 1;
            return 16;
        },
        function (parent){//0xD6: SUB A, nn
            var data = memoryController.readByte(PC + 1);
            var value = parent.getA();
            parent.setHalfCarry((((value & 0x0F) - (data & 0x0F)) & 0xF0) != 0);
            value -= data;
            value &= 0xFFFF;
            parent.setCarry((value & 0xFF00) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(parent.getA() == 0);
            PC += 2;
            return 8
        },
        function (parent){//0xD7: RST 0x10
            PC += 1;
            call(0x10);
            return 16;
        },
        function (parent){//0xD8: RET C
            if (parent.getCarry()){
                ret();
                return 20;
            }
            else{
                PC += 1;
                return 8;
            }
        },
        function (parent){//0xD9: RETI
            IME = true;
            ret();
            return 16;
        },
        function (parent){//0xDA: JP C,nnnn
            var pos = memoryController.readWord(PC + 1);
            if (parent.getCarry()){
                PC = pos;
                return 16;
            }
            else{
                PC += 3;
                return 12;
            }
        },
        instructionErrorVector,//0xDB
        function (parent){//0xDC: CALL C nnnn
            var pos = memoryController.readWord(PC + 1);
            PC += 3;
            if (parent.getCarry()){
                call(pos);
                return 24;
            }
            else{
                return 12;
            }
        },
        instructionErrorVector,//0xDD
        function (parent){//0xDE: SBC A, nn
            var value = parent.getA();
            value -= memoryController.readByte(PC + 1) + (parent.getCarry() ? 1:0);
            value &= 0xFFFF;
            parent.setCarry((value & 0xFF00) != 0);
            parent.setHalfCarry(((parent.getA()^memoryController.readByte(PC + 1)^(value & 0xFF)) & 0x10) != 0);
            parent.setSubtract(true);
            parent.setA(value);
            parent.setZero(parent.getA() == 0);
            PC += 2;
            return 8;
        },
        function (parent){//0xDF: RST 0x18
            PC += 1;
            call(0x18);
            return 16;
        },
        function (parent){//0xE0: LDH (nn), A
            var pos = memoryController.readByte(PC+1) | 0xFF00;
            memoryController.writeByte(pos,parent.getA());
            PC += 2;
            return 12;
        },
        function (parent){//0xE1: POP HL
            HL = memoryController.readWord(SP);
            SP += 2;
            SP &= 0xFFFF;
            PC += 1;
            return 12;
        },
        function (parent){//0xE2: LD (C), A
            var pos = parent.getC() | 0xFF00;
            memoryController.writeByte(pos,parent.getA());
            PC += 1;
            return 8;
        },
        instructionErrorVector,//0xE3
        instructionErrorVector,//0xE4
        function (parent){//0xE5: PUSH HL
            SP -= 2;
            SP &= 0xFFFF;
            memoryController.writeWord(SP,HL);
            PC += 1;
            return 16;
        },
        function (parent){//0xE6: AND A, nn
            var value = memoryController.readByte(PC+1);
            parent.setA(parent.getA() & value);
            parent.setZero(parent.getA() == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setCarry(false);
            PC += 2;
            return 8;
        },
        function (parent){//0xE7: RST 0x20
            PC += 1;
            call(0x20);
            return 16;
        },
        function (parent){//0xE8: ADD SP,nn
            var val = memoryController.readSignedByte(PC+1);
            var value = SP + val;
            parent.setCarry(((SP^val^value) & 0x100) != 0);
            parent.setHalfCarry(((SP^val^value) & 0x10) != 0);
            value &= 0xFFFF;
            parent.setZero(false);
            parent.setSubtract(false);
            SP = value;
            PC += 2;
            return 16;
        },
        function (parent){//0xE9: JP HL
            PC = HL;
            return 4;
        },
        function (parent){//0xEA: LD (nnnn), A
            var pos = memoryController.readWord(PC+1);
            memoryController.writeByte(pos,parent.getA());
            PC += 3;
            return 16;
        },
        instructionErrorVector,//0xEA
        instructionErrorVector,//0xEB
        instructionErrorVector,//0xED
        function (parent){//0xEE: XOR a,nn
            var data = memoryController.readByte(PC+1);
            parent.setA(parent.getA() ^ data);
            parent.setZero(parent.getA() == 0);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            PC += 2;
            return 8;
        },
        function (parent){//0xEF: RST 0x28
            PC += 1;
            call(0x28);
            return 16;
        },
        function (parent){//0xF0: LDH A,(nn)
            var pos = memoryController.readByte(PC+1)| 0xFF00;
            parent.setA(memoryController.readByte(pos));
            PC += 2;
            return 12;
        },
        function (parent){//0xF1: POP AF
            AF = memoryController.readWord(SP) & 0xFFF0;
            SP += 2;
            SP &= 0xFFFF;
            PC += 1;
            return 12;
        },
        function (parent){//0xF2: LD A, (C)
            var pos = parent.getC() | 0xFF00;
            parent.setA(memoryController.readByte(pos));
            PC += 1;
            return 8;
        },
        function (parent){//0xF3: DI
            PC += 1;
            IME = false;
            return 4;
        },
        instructionErrorVector,//0xF4
        function (parent){//0xF5: PUSH AF
            SP -= 2;
            SP &= 0xFFFF;
            memoryController.writeWord(SP,AF);
            PC += 1;
            return 16;
        },
        function (parent){//0xF6: OR A, nn
            var value = memoryController.readByte(PC+1);
            parent.setA(parent.getA() | value);
            parent.setZero(parent.getA() == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setCarry(false);
            PC += 2;
            return 8;
        },
        function (parent){//0xF7: RST 0x30
            PC += 1;
            call(0x30);
            return 16;
        },
        function (parent){//0xF8: LD HL, SP+nn
            var val = memoryController.readSignedByte(PC + 1);
            var value = SP + val;
            value &= 0xFFFF;
            parent.setCarry(((SP^val^value) & 0x100) != 0);
            parent.setHalfCarry(((SP^val^value) & 0x10) != 0);
            HL = value;
            parent.setZero(false);
            parent.setSubtract(false);

            PC += 2;
            return 12;
        },
        function (parent){//0xF9: LD SP, HL
            SP = HL;
            PC += 1;
            return 8;
        },
        function (parent){//0xFA: LD A, (nnnn)
            var position = memoryController.readWord(PC+1);
            parent.setA(memoryController.readByte(position));
            PC += 3;
            return 16;
        },
        function (parent){//0xFB: EI
            PC += 1;
            IME = true;
            return 4;
        },
        instructionErrorVector,//0xFC
        instructionErrorVector,//0xFD
        function (parent){//0xFE: CP A, NN
            var value = memoryController.readByte(PC+1);
            var a = parent.getA();
            parent.setSubtract(true);
            parent.setZero(a == value);
            parent.setCarry(a < value);
            parent.setHalfCarry((a & 0x0F) < (value & 0x0F));
            PC += 2;
            return 8;
        },
        function (parent){//0xFF: RST 0x38
            PC += 1;
            call(0x38);
            return 16;
        }
    ];

    var cbInstruction = [
        function (parent){//0x00: RLC B
            var data = parent.getB();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setB(data);
            return 8;
        },
        function (parent){//0x01: RLC C
            var data = parent.getC();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setC(data);
            return 8;
        },
        function (parent){//0x02: RLC D
            var data = parent.getD();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setD(data);
            return 8;
        },
        function (parent){//0x03: RLC E
            var data = parent.getE();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setE(data);
            return 8;
        },
        function (parent){//0x04: RLC H
            var data = parent.getH();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setH(data);
            return 8;
        },
        function (parent){//0x05: RLC L
            var data = parent.getL();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setL(data);
            return 8;
        },
        function (parent){//0x06: RLC (HL)
            var data = memoryController.readByte(HL);
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            memoryController.writeByte(HL,data);
            return 16;
        },
        function (parent){//0x07: RLC A
            var data = parent.getA();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >> 7);
            data &= 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setA(data);
            return 8;
        },
        function (parent){//0x08: RRC B
            var data = parent.getB();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setB(data);
            return 8;
        },
        function (parent){//0x09: RRC C
            var data = parent.getC();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setC(data);
            return 8;
        },
        function (parent){//0x0A: RRC D
            var data = parent.getD();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setD(data);
            return 8;
        },
        function (parent){//0x0B: RRC E
            var data = parent.getE();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setE(data);
            return 8;
        },
        function (parent){//0x0C: RRC H
            var data = parent.getH();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setH(data);
            return 8;
        },
        function (parent){//0x0D: RRC L
            var data = parent.getL();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setL(data);
            return 8;
        },
        function (parent){//0x0E: RRC (HL)
            var data = memoryController.readByte(HL);
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            memoryController.writeByte(HL,data);
            return 16;
        },
        function (parent){//0x0F: RRC A
            var data = parent.getA();
            parent.setCarry((data & 0x01) != 0);
            data = ((data >> 1) | (data << 7)) & 0xFF;
            parent.setZero(data == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setA(data);
            return 8;
        },
        function (parent){//0x10: RL B
            var value = parent.getB();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setB(result);
            return 8;
        },
        function (parent){//0x11: RL C
            var value = parent.getC();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setC(result);
            return 8;
        },
        function (parent){//0x12: RL D
            var value = parent.getD();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setD(result);
            return 8;
        },
        function (parent){//0x13: RL E
            var value = parent.getE();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setE(result);
            return 8;
        },
        function (parent){//0x14: RL H
            var value = parent.getH();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setH(result);
            return 8;
        },
        function (parent){//0x15: RL L
            var value = parent.getL();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setL(result);
            return 8;
        },
        function (parent){//0x16: RL (HL)
            var value = memoryController.readByte(HL);
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            memoryController.writeByte(HL,result);
            return 16;
        },
        function (parent){//0x17: RL A
            var value = parent.getA();
            var result = ((value << 1) & 0xFF) | (parent.getCarry() ? 1 : 0);
            parent.setCarry((value & 0x80) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setA(result);
            return 8;
        },
        function (parent){//0x18: RR B
            var value = parent.getB();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setB(result);
            return 8;
        },
        function (parent){//0x19: RR C
            var value = parent.getC();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setC(result);
            return 8;
        },
        function (parent){//0x1A: RR D
            var value = parent.getD();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setD(result);
            return 8;
        },
        function (parent){//0x1B: RR E
            var value = parent.getE();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setE(result);
            return 8;
        },
        function (parent){//0x1C: RR H
            var value = parent.getH();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setH(result);
            return 8;
        },
        function (parent){//0x1D: RR L
            var value = parent.getL();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setL(result);
            return 8;
        },
        function (parent){//0x1E: RR (HL)
            var value = memoryController.readByte(HL);
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            memoryController.writeByte(HL,result);
            return 16;
        },
        function (parent){//0x1F: RR A
            var value = parent.getA();
            var result = (value >> 1)  | (parent.getCarry() ? 0x80 : 0);
            parent.setCarry((value & 0x01) != 0);
            parent.setZero(result == 0);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setA(result);
            return 8;
        },
        function (parent){//0x20: SLA B
            var data = parent.getB();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setB(data);
            return 8;
        },
        function (parent){//0x21: SLA C
            var data = parent.getC();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setC(data);
            return 8;
        },
        function (parent){//0x22: SLA D
            var data = parent.getD();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setD(data);
            return 8;
        },
        function (parent){//0x23: SLA E
            var data = parent.getE();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setE(data);
            return 8;
        },
        function (parent){//0x24: SLA H
            var data = parent.getH();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setH(data);
            return 8;
        },
        function (parent){//0x25: SLA L
            var data = parent.getL();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setL(data);
            return 8;
        },
        function (parent){//0x26: SLA (HL)
            var data = memoryController.readByte(HL);
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            memoryController.writeByte(HL,data);
            return 16;
        },
        function (parent){//0x27: SLA A
            var data = parent.getA();
            parent.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setA(data);
            return 8;
        },
        function (parent){//0x28: SRA B
            var data = parent.getB();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setB(data);
            return 8;
        },
        function (parent){//0x29: SRA C
            var data = parent.getC();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setC(data);
            return 8;
        },
        function (parent){//0x2A: SRA D
            var data = parent.getD();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setD(data);
            return 8;
        },
        function (parent){//0x2B: SRA E
            var data = parent.getE();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setE(data);
            return 8;
        },
        function (parent){//0x2C: SRA H
            var data = parent.getH();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setH(data);
            return 8;
        },
        function (parent){//0x2D: SRA L
            var data = parent.getL();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setL(data);
            return 8;
        },
        function (parent){//0x2E: SRA (HL)
            var data = memoryController.readByte(HL);
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            memoryController.writeByte(HL,data);
            return 16;
        },
        function (parent){//0x2F: SRA A
            var data = parent.getA();
            parent.setCarry((data & 0x01) != 0);
            data = (data >> 1) | (data & 0x80);
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setA(data);
            return 8;
        },
        function (parent){//0x30: SWAP B
            var data = parent.getB();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setB(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x31: SWAP C
            var data = parent.getC();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setC(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x32: SWAP D
            var data = parent.getD();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setD(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x33: SWAP E
            var data = parent.getE();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setE(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x34: SWAP H
            var data = parent.getH();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setH(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x35: SWAP L
            var data = parent.getL();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setL(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x36: SWAP (HL)
            var data = memoryController.readByte(HL);
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            memoryController.writeByte(HL,((data & 0x0F) << 4) | (data >> 4));
            return 16;
        },
        function (parent){//0x37: SWAP A
            var data = parent.getA();
            parent.setSubtract(false);
            parent.setCarry(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setA(((data & 0x0F) << 4) | (data >> 4));
            return 8;
        },
        function (parent){//0x38: SRL B
            var data = parent.getB();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setB(data);
            return 8;
        },
        function (parent){//0x39: SRL C
            var data = parent.getC();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setC(data);
            return 8;
        },
        function (parent){//0x3A: SRL D
            var data = parent.getD();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setD(data);
            return 8;
        },
        function (parent){//0x3B: SRL E
            var data = parent.getE();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setE(data);
            return 8;
        },
        function (parent){//0x3C: SRL H
            var data = parent.getH();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setH(data);
            return 8;
        },
        function (parent){//0x3D: SRL L
            var data = parent.getL();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setL(data);
            return 8;
        },
        function (parent){//0x3E: SRL (HL)
            var data = memoryController.readByte(HL);
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            memoryController.writeByte(HL,data);
            return 16;
        },
        function (parent){//0x3F: SRL A
            var data = parent.getA();
            parent.setCarry((data & 0x01) != 0);
            data >>= 1;
            parent.setSubtract(false);
            parent.setHalfCarry(false);
            parent.setZero(data == 0);
            parent.setA(data);
            return 8;
        },
        function (parent){//0x40: BIT 0, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x41: BIT 0, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x42: BIT 0, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x43: BIT 0, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x44: BIT 0, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x45: BIT 0, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x46: BIT 0, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x01) == 0);
            return 12;
        },
        function (parent){//0x47: BIT 0, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x01) == 0);
            return 8;
        },
        function (parent){//0x48: BIT 1, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x49: BIT 1, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x4A: BIT 1, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x4B: BIT 1, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x4C: BIT 1, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x4D: BIT 1, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x4E: BIT 1, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x02) == 0);
            return 12;
        },
        function (parent){//0x4F: BIT 1, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x02) == 0);
            return 8;
        },
        function (parent){//0x50: BIT 2, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x51: BIT 2, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x52: BIT 2, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x53: BIT 2, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x54: BIT 2, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x55: BIT 2, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x56: BIT 2, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x04) == 0);
            return 12;
        },
        function (parent){//0x57: BIT 2, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x04) == 0);
            return 8;
        },
        function (parent){//0x58: BIT 3, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x59: BIT 3, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x5A: BIT 3, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x5B: BIT 3, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x5C: BIT 3, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x5D: BIT 3, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x5E: BIT 3, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x08) == 0);
            return 12;
        },
        function (parent){//0x5F: BIT 3, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x08) == 0);
            return 8;
        },
        function (parent){//0x60: BIT 4, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x61: BIT 4, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x62: BIT 4, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x63: BIT 4, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x64: BIT 4, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x65: BIT 4, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x66: BIT 4, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x10) == 0);
            return 12;
        },
        function (parent){//0x67: BIT 4, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x10) == 0);
            return 8;
        },
        function (parent){//0x68: BIT 5, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x69: BIT 5, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x6A: BIT 5, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x6B: BIT 5, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x6C: BIT 5, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x6D: BIT 5, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x6E: BIT 5, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x20) == 0);
            return 12;
        },
        function (parent){//0x6F: BIT 5, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x20) == 0);
            return 8;
        },
        function (parent){//0x70: BIT 6, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x71: BIT 6, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x72: BIT 6, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x73: BIT 6, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x74: BIT 6, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x75: BIT 6, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x76: BIT 6, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x40) == 0);
            return 12;
        },
        function (parent){//0x77: BIT 6, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x40) == 0);
            return 8;
        },
        function (parent){//0x78: BIT 7, B
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getB() & 0x80) == 0);
            return 8;
        },
        function (parent){//0x79: BIT 7, C
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getC() & 0x80) == 0);
            return 8;
        },
        function (parent){//0x7A: BIT 7, D
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getD() & 0x80) == 0);
            return 8;
        },
        function (parent){//0x7B: BIT 7, E
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getE() & 0x80) == 0);
            return 8;
        },
        function (parent){//0x7C: BIT 7, H
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getH() & 0x80) == 0);
            return 8;
        },
        function (parent){//0x7D: BIT 7, L
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getL() & 0x80) == 0);
            return 8;
        },
        function (parent){//0x7E: BIT 7, (HL)
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((memoryController.readByte(HL) & 0x80) == 0);
            return 12;
        },
        function (parent){//0x7F: BIT 7, A
            parent.setSubtract(false);
            parent.setHalfCarry(true);
            parent.setZero((parent.getA() & 0x80) == 0);
            return 8;
        },
        function(parent){//0x80 RES 0, B
            parent.setB(parent.getB() & 0xFE);
            return 8;
        },
        function(parent){//0x81 RES 0, C
            parent.setC(parent.getC() & 0xFE);
            return 8;
        },
        function(parent){//0x82 RES 0, D
            parent.setD(parent.getD() & 0xFE);
            return 8;
        },
        function(parent){//0x83 RES 0, E
            parent.setE(parent.getE() & 0xFE);
            return 8;
        },
        function(parent){//0x84 RES 0, H
            parent.setH(parent.getH() & 0xFE);
            return 8;
        },
        function(parent){//0x85 RES 0, L
            parent.setL(parent.getL() & 0xFE);
            return 8;
        },
        function(parent){//0x86 RES 0, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xFE);
            return 16;
        },
        function(parent){//0x87 RES 0, A
            parent.setA(parent.getA() & 0xFE);
            return 8;
        },
        function(parent){//0x88 RES 1, B
            parent.setB(parent.getB() & 0xFD);
            return 8;
        },
        function(parent){//0x89 RES 1, C
            parent.setC(parent.getC() & 0xFD);
            return 8;
        },
        function(parent){//0x8A RES 1, D
            parent.setD(parent.getD() & 0xFD);
            return 8;
        },
        function(parent){//0x8B RES 1, E
            parent.setE(parent.getE() & 0xFD);
            return 8;
        },
        function(parent){//0x8C RES 1, H
            parent.setH(parent.getH() & 0xFD);
            return 8;
        },
        function(parent){//0x8D RES 1, L
            parent.setL(parent.getL() & 0xFD);
            return 8;
        },
        function(parent){//0x8E RES 1, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xFD);
            return 16;
        },
        function(parent){//0x8F RES 1, A
            parent.setA(parent.getA() & 0xFD);
            return 8;
        },
        function(parent){//0x90 RES 2, B
            parent.setB(parent.getB() & 0xFB);
            return 8;
        },
        function(parent){//0x91 RES 2, C
            parent.setC(parent.getC() & 0xFB);
            return 8;
        },
        function(parent){//0x92 RES 2, D
            parent.setD(parent.getD() & 0xFB);
            return 8;
        },
        function(parent){//0x93 RES 2, E
            parent.setE(parent.getE() & 0xFB);
            return 8;
        },
        function(parent){//0x94 RES 2, H
            parent.setH(parent.getH() & 0xFB);
            return 8;
        },
        function(parent){//0x95 RES 2, L
            parent.setL(parent.getL() & 0xFB);
            return 8;
        },
        function(parent){//0x96 RES 2, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xFB);
            return 16;
        },
        function(parent){//0x97 RES 2, A
            parent.setA(parent.getA() & 0xFB);
            return 8;
        },
        function(parent){//0x98 RES 3, B
            parent.setB(parent.getB() & 0xF7);
            return 8;
        },
        function(parent){//0x99 RES 3, C
            parent.setC(parent.getC() & 0xF7);
            return 8;
        },
        function(parent){//0x9A RES 3, D
            parent.setD(parent.getD() & 0xF7);
            return 8;
        },
        function(parent){//0x9B RES 3, E
            parent.setE(parent.getE() & 0xF7);
            return 8;
        },
        function(parent){//0x9C RES 3, H
            parent.setH(parent.getH() & 0xF7);
            return 8;
        },
        function(parent){//0x9D RES 3, L
            parent.setL(parent.getL() & 0xF7);
            return 8;
        },
        function(parent){//0x9E RES 3, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xF7);
            return 16;
        },
        function(parent){//0x9F RES 3, A
            parent.setA(parent.getA() & 0xF7);
            return 8;
        },
        function(parent){//0xA0 RES 4, B
            parent.setB(parent.getB() & 0xEF);
            return 8;
        },
        function(parent){//0xA1 RES 4, C
            parent.setC(parent.getC() & 0xEF);
            return 8;
        },
        function(parent){//0xA2 RES 4, D
            parent.setD(parent.getD() & 0xEF);
            return 8;
        },
        function(parent){//0xA3 RES 4, E
            parent.setE(parent.getE() & 0xEF);
            return 8;
        },
        function(parent){//0xA4 RES 4, H
            parent.setH(parent.getH() & 0xEF);
            return 8;
        },
        function(parent){//0xA5 RES 4, L
            parent.setL(parent.getL() & 0xEF);
            return 8;
        },
        function(parent){//0xA6 RES 4, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xEF);
            return 16;
        },
        function(parent){//0xA7 RES 4, A
            parent.setA(parent.getA() & 0xEF);
            return 8;
        },
        function(parent){//0xA8 RES 5, B
            parent.setB(parent.getB() & 0xDF);
            return 8;
        },
        function(parent){//0xA9 RES 5, C
            parent.setC(parent.getC() & 0xDF);
            return 8;
        },
        function(parent){//0xAA RES 5, D
            parent.setD(parent.getD() & 0xDF);
            return 8;
        },
        function(parent){//0xAB RES 5, E
            parent.setE(parent.getE() & 0xDF);
            return 8;
        },
        function(parent){//0xAC RES 5, H
            parent.setH(parent.getH() & 0xDF);
            return 8;
        },
        function(parent){//0xAD RES 5, L
            parent.setL(parent.getL() & 0xDF);
            return 8;
        },
        function(parent){//0xAE RES 5, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xDF);
            return 16;
        },
        function(parent){//0xAF RES 5, A
            parent.setA(parent.getA() & 0xDF);
            return 8;
        },
        function(parent){//0xB0 RES 6, B
            parent.setB(parent.getB() & 0xBF);
            return 8;
        },
        function(parent){//0xB1 RES 6, C
            parent.setC(parent.getC() & 0xBF);
            return 8;
        },
        function(parent){//0xB2 RES 6, D
            parent.setD(parent.getD() & 0xBF);
            return 8;
        },
        function(parent){//0xB3 RES 6, E
            parent.setE(parent.getE() & 0xBF);
            return 8;
        },
        function(parent){//0xB4 RES 6, H
            parent.setH(parent.getH() & 0xBF);
            return 8;
        },
        function(parent){//0xB5 RES 6, L
            parent.setL(parent.getL() & 0xBF);
            return 8;
        },
        function(parent){//0xB6 RES 6, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0xBF);
            return 16;
        },
        function(parent){//0xB7 RES 6, A
            parent.setA(parent.getA() & 0xBF);
            return 8;
        },
        function(parent){//0xB8 RES 7, B
            parent.setB(parent.getB() & 0x7F);
            return 8;
        },
        function(parent){//0xB9 RES 7, C
            parent.setC(parent.getC() & 0x7F);
            return 8;
        },
        function(parent){//0xBA RES 7, D
            parent.setD(parent.getD() & 0x7F);
            return 8;
        },
        function(parent){//0xBB RES 7, E
            parent.setE(parent.getE() & 0x7F);
            return 8;
        },
        function(parent){//0xBC RES 7, H
            parent.setH(parent.getH() & 0x7F);
            return 8;
        },
        function(parent){//0xBD RES 7, L
            parent.setL(parent.getL() & 0x7F);
            return 8;
        },
        function(parent){//0xBE RES 7, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) & 0x7F);
            return 16;
        },
        function(parent){//0xBF RES 7, A
            parent.setA(parent.getA() & 0x7F);
            return 8;
        },
        function(parent){//0xC0 SET 0, B
            parent.setB(parent.getB() | 0x1);
            return 8;
        },
        function(parent){//0xC1 SET 0, C
            parent.setC(parent.getC() | 0x1);
            return 8;
        },
        function(parent){//0xC2 SET 0, D
            parent.setD(parent.getD() | 0x1);
            return 8;
        },
        function(parent){//0xC3 SET 0, E
            parent.setE(parent.getE() | 0x1);
            return 8;
        },
        function(parent){//0xC4 SET 0, H
            parent.setH(parent.getH() | 0x1);
            return 8;
        },
        function(parent){//0xC5 SET 0, L
            parent.setL(parent.getL() | 0x1);
            return 8;
        },
        function(parent){//0xC6 SET 0, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x1);
            return 16;
        },
        function(parent){//0xC7 SET 0, A
            parent.setA(parent.getA() | 0x1);
            return 8;
        },
        function(parent){//0xC8 SET 1, B
            parent.setB(parent.getB() | 0x2);
            return 8;
        },
        function(parent){//0xC9 SET 1, C
            parent.setC(parent.getC() | 0x2);
            return 8;
        },
        function(parent){//0xCA SET 1, D
            parent.setD(parent.getD() | 0x2);
            return 8;
        },
        function(parent){//0xCB SET 1, E
            parent.setE(parent.getE() | 0x2);
            return 8;
        },
        function(parent){//0xCC SET 1, H
            parent.setH(parent.getH() | 0x2);
            return 8;
        },
        function(parent){//0xCD SET 1, L
            parent.setL(parent.getL() | 0x2);
            return 8;
        },
        function(parent){//0xCE SET 1, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x2);
            return 16;
        },
        function(parent){//0xCF SET 1, A
            parent.setA(parent.getA() | 0x2);
            return 8;
        },
        function(parent){//0xD0 SET 2, B
            parent.setB(parent.getB() | 0x4);
            return 8;
        },
        function(parent){//0xD1 SET 2, C
            parent.setC(parent.getC() | 0x4);
            return 8;
        },
        function(parent){//0xD2 SET 2, D
            parent.setD(parent.getD() | 0x4);
            return 8;
        },
        function(parent){//0xD3 SET 2, E
            parent.setE(parent.getE() | 0x4);
            return 8;
        },
        function(parent){//0xD4 SET 2, H
            parent.setH(parent.getH() | 0x4);
            return 8;
        },
        function(parent){//0xD5 SET 2, L
            parent.setL(parent.getL() | 0x4);
            return 8;
        },
        function(parent){//0xD6 SET 2, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x4);
            return 16;
        },
        function(parent){//0xD7 SET 2, A
            parent.setA(parent.getA() | 0x4);
            return 8;
        },
        function(parent){//0xD8 SET 3, B
            parent.setB(parent.getB() | 0x8);
            return 8;
        },
        function(parent){//0xD9 SET 3, C
            parent.setC(parent.getC() | 0x8);
            return 8;
        },
        function(parent){//0xDA SET 3, D
            parent.setD(parent.getD() | 0x8);
            return 8;
        },
        function(parent){//0xDB SET 3, E
            parent.setE(parent.getE() | 0x8);
            return 8;
        },
        function(parent){//0xDC SET 3, H
            parent.setH(parent.getH() | 0x8);
            return 8;
        },
        function(parent){//0xDD SET 3, L
            parent.setL(parent.getL() | 0x8);
            return 8;
        },
        function(parent){//0xDE SET 3, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x8);
            return 16;
        },
        function(parent){//0xDF SET 3, A
            parent.setA(parent.getA() | 0x8);
            return 8;
        },
        function(parent){//0xE0 SET 4, B
            parent.setB(parent.getB() | 0x10);
            return 8;
        },
        function(parent){//0xE1 SET 4, C
            parent.setC(parent.getC() | 0x10);
            return 8;
        },
        function(parent){//0xE2 SET 4, D
            parent.setD(parent.getD() | 0x10);
            return 8;
        },
        function(parent){//0xE3 SET 4, E
            parent.setE(parent.getE() | 0x10);
            return 8;
        },
        function(parent){//0xE4 SET 4, H
            parent.setH(parent.getH() | 0x10);
            return 8;
        },
        function(parent){//0xE5 SET 4, L
            parent.setL(parent.getL() | 0x10);
            return 8;
        },
        function(parent){//0xE6 SET 4, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x10);
            return 16;
        },
        function(parent){//0xE7 SET 4, A
            parent.setA(parent.getA() | 0x10);
            return 8;
        },
        function(parent){//0xE8 SET 5, B
            parent.setB(parent.getB() | 0x20);
            return 8;
        },
        function(parent){//0xE9 SET 5, C
            parent.setC(parent.getC() | 0x20);
            return 8;
        },
        function(parent){//0xEA SET 5, D
            parent.setD(parent.getD() | 0x20);
            return 8;
        },
        function(parent){//0xEB SET 5, E
            parent.setE(parent.getE() | 0x20);
            return 8;
        },
        function(parent){//0xEC SET 5, H
            parent.setH(parent.getH() | 0x20);
            return 8;
        },
        function(parent){//0xED SET 5, L
            parent.setL(parent.getL() | 0x20);
            return 8;
        },
        function(parent){//0xEE SET 5, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x20);
            return 16;
        },
        function(parent){//0xEF SET 5, A
            parent.setA(parent.getA() | 0x20);
            return 8;
        },
        function(parent){//0xF0 SET 6, B
            parent.setB(parent.getB() | 0x40);
            return 8;
        },
        function(parent){//0xF1 SET 6, C
            parent.setC(parent.getC() | 0x40);
            return 8;
        },
        function(parent){//0xF2 SET 6, D
            parent.setD(parent.getD() | 0x40);
            return 8;
        },
        function(parent){//0xF3 SET 6, E
            parent.setE(parent.getE() | 0x40);
            return 8;
        },
        function(parent){//0xF4 SET 6, H
            parent.setH(parent.getH() | 0x40);
            return 8;
        },
        function(parent){//0xF5 SET 6, L
            parent.setL(parent.getL() | 0x40);
            return 8;
        },
        function(parent){//0xF6 SET 6, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x40);
            return 16;
        },
        function(parent){//0xF7 SET 6, A
            parent.setA(parent.getA() | 0x40);
            return 8;
        },
        function(parent){//0xF8 SET 7, B
            parent.setB(parent.getB() | 0x80);
            return 8;
        },
        function(parent){//0xF9 SET 7, C
            parent.setC(parent.getC() | 0x80);
            return 8;
        },
        function(parent){//0xFA SET 7, D
            parent.setD(parent.getD() | 0x80);
            return 8;
        },
        function(parent){//0xFB SET 7, E
            parent.setE(parent.getE() | 0x80);
            return 8;
        },
        function(parent){//0xFC SET 7, H
            parent.setH(parent.getH() | 0x80);
            return 8;
        },
        function(parent){//0xFD SET 7, L
            parent.setL(parent.getL() | 0x80);
            return 8;
        },
        function(parent){//0xFE SET 7, (HL)
            memoryController.writeByte(HL,memoryController.readByte(HL) | 0x80);
            return 16;
        },
        function(parent){//0xFF SET 7, A
            parent.setA(parent.getA() | 0x80);
            return 8;
        }
    ]

    var errorShown = false;

    function instructionErrorVector(){
        if (!errorShown){
            errorShown = true;
            console.error("Unrecognized opcode encountered: 0x" + (memoryController.readByte(PC)).toString(16).toUpperCase());
        }
        return 4;
    }

    return CPUEmulator;

});
