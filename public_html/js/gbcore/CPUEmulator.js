define (function(){

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
    INT_VBLANK = 0, INT_LCDSTAT = 1, INT_TIMER = 2, INT_SERIAL = 3, INT_JPAD = 4;

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
    }

    function call(address){
        SP -= 2;
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
        switch (opcode){
            case 0x00: //NOP
            {
                cycles += 4;
                PC += 1;
                break;
            }
            case 0x07: //RLCA
            {
                var data = this.getA();
                this.setCarry((data & 0x80) != 0);
                this.setA((data << 1) | (data >> 7));
                this.setZero(false);
                this.setSubtract(false);
                this.setHalfCarry(false);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x08: //LD (nnnn), SP
            {
                var location = memoryController.readWord(PC+1);
                memoryController.writeWord(location,SP);
                PC += 3;
                cycles += 20;
                break;
            }
            case 0x0F: //RRCA
            {
                var a = this.getA();
                this.setCarry((a & 0x01) != 0);
                a >>= 1;
                if (this.getCarry())
                    a |= 0x80;
                this.setA(a);
                this.setZero(false);
                this.setHalfCarry(false);
                this.setSubtract(false);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x10: //STOP
            {
                if (gbcEnabled){
                    doubleSpeedMode = enteringDoubleSpeedMode;
                    memoryController.writeByte(0xFF4D, (memoryController.readByte(0xFF4D) & 0x7F) | (doubleSpeedMode ? 0x80 : 0),true);
                }
                else{
                    IME = true;
                    suspended = true;
                }
                PC += 2;
                cycles += 4;
                break;
            }
            case 0x17: //RLA
            {
                var data = this.getA();
                data <<= 1;
                if (this.getCarry())
                    data |= 1;
                data &= 0xFF;
                this.setCarry((this.getA() & 0x80) != 0);
                this.setZero(false);
                this.setSubtract(false);
                this.setHalfCarry(false);
                this.setA(data);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x18: //JR nn
            {
                var pos = memoryController.readSignedByte(PC+1);
                PC += pos + 2;
                cycles += 12;
                break;
            }
            case 0x1F: //RRA
            {
                var a = this.getA();
                a = (a >> 1) | (this.getCarry() ? 0x80 : 0);
                this.setCarry((this.getA() & 1) != 0);
                this.setA(a);
                this.setSubtract(false);
                this.setHalfCarry(false);
                this.setZero(false);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x20: //JR NZ, nn
            {
                var pos = memoryController.readSignedByte(PC+1);
                if (!this.getZero()){
                    PC += pos + 2;
                    cycles += 12;
                }
                else{
                    PC += 2;
                    cycles += 8;
                }
                break;
            }
            case 0x27: //DAA
            {
                var a = this.getA();

                if (!this.getSubtract()){
                    if (this.getHalfCarry() || (a & 0x0F) > 9)
                        a += 6;
                    if (this.getCarry() || a > 0x9F)
                        a += 0x60;
                }
                else{
                    if (this.getHalfCarry()){
                        a -= 6;
                        a &= 0xFF;
                    }
                    if (this.getCarry())
                        a -= 0x60;
                }

                this.setHalfCarry(false);

                if ((a & 0x100) == 0x100)
                    this.setCarry(true);

                this.setA(a);
                this.setZero(this.getA() == 0);

                PC += 1;
                cycles += 4;
                break;
            }
            case 0x28: //JR Z,nn
            {
                var pos = memoryController.readSignedByte(PC+1);
                if (this.getZero()){
                    PC += pos + 2;
                    cycles += 12;
                }
                else{
                    PC += 2;
                    cycles += 8;
                }
                break;
            }
            case 0x2F: //CPL
            {
                this.setA(this.getA() ^ 255);
                this.setHalfCarry(true);
                this.setSubtract(true);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x30: //JR NC, nn
            {
                var pos = memoryController.readSignedByte(PC+1);
                if (!this.getCarry()){
                    PC += pos + 2;
                    cycles += 12;
                }
                else{
                    PC += 2;
                    cycles += 8;
                }
                break;
            }
            case 0x37: //SCF
            {
                this.setCarry(true);
                this.setHalfCarry(false);
                this.setSubtract(false);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x38: //JR C,nn
            {
                var pos = memoryController.readSignedByte(PC+1);
                if (this.getCarry()){
                    PC += pos + 2;
                    cycles += 12;
                }
                else{
                    PC += 2;
                    cycles += 8;
                }
                break;
            }
            case 0x3F://CCF
            {
                this.setCarry(!this.getCarry());
                this.setSubtract(false);
                this.setHalfCarry(false);
                PC += 1;
                cycles += 4;
                break;
            }
            case 0x76: //HALT
            {
                IME = true;
                suspended = true;
                PC += 1;
                cycles += 4;
                break;
            }
            case 0xC0: //RET NZ
            {
                if (!this.getZero()){
                    ret();
                    cycles += 20;
                }
                else{
                    PC += 1;
                    cycles += 8;
                }
                break;
            }
            case 0xC2: //JP NZ, nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                if (!this.getZero()){
                    PC = pos;
                    cycles += 16;
                }
                else{
                    PC += 3;
                    cycles += 12;
                }
                break;
            }
            case 0xC3: //JP NNNN
            {
                PC = memoryController.readWord(PC + 1);
                cycles += 16;
                break;
            }
            case 0xC4: //CALL NZ nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                PC += 3;
                if (!this.getZero()){
                    call(pos);
                    cycles += 24;
                }
                else{
                    cycles += 12;
                }
                break;
            }
            case 0xC6: //ADD A, nn
            {
                cycles += 8;
                var data = memoryController.readByte(PC + 1);
                var a = this.getA();
                this.setHalfCarry((((a & 0x0F) + (data & 0x0F)) & 0xF0) != 0);
                var value = a + data;
                this.setSubtract(false);
                this.setCarry((value & 0xFF00) != 0);
                this.setA(value);
                this.setZero(this.getA() == 0);
                PC += 2;
                break;
            }
            case 0xC8: //RET Z
            {
                if (this.getZero()){
                    ret();
                    cycles += 20;
                }
                else{
                    PC += 1;
                    cycles += 8;
                }
                break;
            }
            case 0xC9: //RET
            {
                ret();
                cycles += 16;
                break;
            }
            case 0xCA: //JP Z, nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                if (this.getZero()){
                    PC = pos;
                    cycles += 16;
                }
                else{
                    PC += 3;
                    cycles += 12;
                }
                break;
            }
            case 0xCB: //bitshift / test
            {
                cycles += 8;
                if ((memoryController.readByte(PC+1) & 0x0F) == 0x0E || (memoryController.readByte(PC+1) & 0x0F) == 0x06){
                    cycles += 4;
                    switch (memoryController.readByte(PC+1) & 0xF0){
                        case 0x40:
                        case 0x50:
                        case 0x60:
                        case 0x70:
                            break;
                        default:
                            cycles += 4;
                    }
                }
                this.executeCBInstruction();
                PC += 2;
                break;
            }
            case 0xCC: //CALL Z nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                PC += 3;
                if (this.getZero()){
                    call(pos);
                    cycles += 24;
                }
                else{
                    cycles += 12;
                }
                break;
            }
            case 0xCD: //CALL nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                PC += 3;
                call(pos);
                cycles += 24;
                break;
            }
            case 0xCE: //ADC A, nn
            {
                var value = this.getA() + memoryController.readByte(PC + 1) + (this.getCarry() ? 1:0);
                this.setHalfCarry(((this.getA()^memoryController.readByte(PC + 1)^(value & 0xFF)) & 0x10) != 0);
                this.setSubtract(false);
                this.setCarry((value & 0xFF00) != 0);
                this.setA(value);
                this.setZero(this.getA() == 0);
                PC += 2;
                cycles += 8;
                break;
            }
            case 0xD0: //RET NC
            {
                if (!this.getCarry()){
                    ret();
                    cycles += 20;
                }
                else{
                    PC += 1;
                    cycles += 8;
                }
                break;
            }
            case 0xD2: //JP NC, nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                if (!this.getCarry()){
                    PC = pos;
                    cycles += 16;
                }
                else{
                    PC += 3;
                    cycles += 12;
                }
                break;
            }
            case 0xD4: //CALL NC nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                PC += 3;
                if (!this.getCarry()){
                    call(pos);
                    cycles += 24;
                }
                else{
                    cycles += 12;
                }
                break;
            }
            case 0xD6: //SUB A, nn
            {
                cycles += 8;
                var data = memoryController.readByte(PC + 1);
                var value = this.getA();
                this.setHalfCarry((((value & 0x0F) - (data & 0x0F)) & 0xF0) != 0);
                value -= data;
                value &= 0xFFFF;
                this.setCarry((value & 0xFF00) != 0);
                this.setSubtract(true);
                this.setA(value);
                this.setZero(this.getA() == 0);
                PC += 2;
                break;
            }
            case 0xD8: //RET C
            {
                if (this.getCarry()){
                    ret();
                    cycles += 20;
                }
                else{
                    PC += 1;
                    cycles += 8;
                }
                break;
            }
            case 0xD9: //RETI
            {
                IME = true;
                ret();
                cycles += 16;
                break;
            }
            case 0xDA: //JP C,nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                if (this.getCarry()){
                    PC = pos;
                    cycles += 16;
                }
                else{
                    PC += 3;
                    cycles += 12;
                }
                break;
            }
            case 0xDC: //CALL C nnnn
            {
                var pos = memoryController.readWord(PC + 1);
                PC += 3;
                if (this.getCarry()){
                    call(pos);
                    cycles += 24;
                }
                else{
                    cycles += 12;
                }
                break;
            }
            case 0xDE: //SBC A, nn
            {
                var value = this.getA();
                value -= memoryController.readByte(PC + 1) + (this.getCarry() ? 1:0);
                value &= 0xFFFF;
                this.setCarry((value & 0xFF00) != 0);
                this.setHalfCarry(((this.getA()^memoryController.readByte(PC + 1)^(value & 0xFF)) & 0x10) != 0);
                this.setSubtract(true);
                this.setA(value);
                this.setZero(this.getA() == 0);
                PC += 2;
                cycles += 8;
                break;
            }
            case 0xE0: //LDH (nn),A
            {
                var pos = memoryController.readByte(PC+1) | 0xFF00;
                memoryController.writeByte(pos,this.getA());
                PC += 2;
                cycles += 12;
                break;
            }
            case 0xE2: //LD (C), A
            {
                var pos = this.getC() | 0xFF00;
                memoryController.writeByte(pos,this.getA());
                PC += 1;
                cycles += 8;
                break;
            }
            case 0xE6: //AND A, nn
            {
                var value = memoryController.readByte(PC+1);
                this.setA(this.getA() & value);
                this.setZero(this.getA() == 0);
                this.setSubtract(false);
                this.setHalfCarry(true);
                this.setCarry(false);
                PC += 2;
                cycles += 8;
                break;
            }
            case 0xE8: //ADD SP,nn
            {
                var val = memoryController.readSignedByte(PC+1);
                var value = SP + val;
                this.setCarry(((SP^val^value) & 0x100) != 0);
                this.setHalfCarry(((SP^val^value) & 0x10) != 0);
                value &= 0xFFFF;
                this.setZero(false);
                this.setSubtract(false);
                SP = value;
                PC += 2;
                cycles += 16;
                break;
            }
            case 0xE9: //JP HL
            {
                PC = HL;
                cycles += 4;
                break;
            }
            case 0xEA: //LD (nnnn),A
            {
                var pos = memoryController.readWord(PC+1);
                memoryController.writeByte(pos,this.getA());
                PC += 3;
                cycles += 16;
                break;
            }
            case 0xEE: //XOR a, nn
            {
                var data = memoryController.readByte(PC+1);
                this.setA(this.getA() ^ data);
                this.setZero(this.getA() == 0);
                this.setSubtract(false);
                this.setCarry(false);
                this.setHalfCarry(false);
                cycles += 8;
                PC += 2;
                break;
            }
            case 0xF0: //LDH A,(nn)
            {
                var pos = memoryController.readByte(PC+1)| 0xFF00;
                this.setA(memoryController.readByte(pos));
                PC += 2;
                cycles += 12;
                break;
            }
            case 0xF2: //LD A, (C)
            {
                var pos = this.getC() | 0xFF00;
                this.setA(memoryController.readByte(pos));
                PC += 1;
                cycles += 8;
                break;
            }
            case 0xF3: //DI
            {
                PC += 1;
                IME = false;
                cycles += 4;
                break;
            }
            case 0xF6: //OR A, nn
            {
                var value = memoryController.readByte(PC+1);
                this.setA(this.getA() | value);
                this.setZero(this.getA() == 0);
                this.setSubtract(false);
                this.setHalfCarry(false);
                this.setCarry(false);
                PC += 2;
                cycles += 8;
                break;
            }
            case 0xF8: //LD HL, SP+nn
            {
                var val = memoryController.readSignedByte(PC + 1);
                var value = SP + val;
                value &= 0xFFFF;
                this.setCarry(((SP^val^value) & 0x100) != 0);
                this.setHalfCarry(((SP^val^value) & 0x10) != 0);
                HL = value;
                this.setZero(false);
                this.setSubtract(false);

                PC += 2;
                cycles += 12;
                break;
            }
            case 0xF9: //LD SP, HL
            {
                SP = HL;
                PC += 1;
                cycles += 8;
                break;
            }
            case 0xFA: //LD A, (nnnn)
            {
                var position = memoryController.readWord(PC+1);
                this.setA(memoryController.readByte(position));
                PC += 3;
                cycles += 16;
                break;
            }
            case 0xFB: //EI
            {
                PC += 1;
                IME = true;
                cycles += 4;
                break;
            }

            case 0xFE: //CP A, NN
            {
                var value = memoryController.readByte(PC+1);
                var a = this.getA();
                this.setSubtract(true);
                this.setZero(a == value);
                this.setCarry(a < value);
                this.setHalfCarry((a & 0x0F) < (value & 0x0F));
                PC += 2;
                cycles += 8;
                break;
            }
            default:
            {
                if (opcode <= 0x3F){
                    if ((opcode & 0x0F) == 0x01){ //LD 16bitreg, nnnn
                        var reg = Math.floor(opcode / 0x10);
                        var val = memoryController.readWord(PC + 1);
                        this.setIndexed16BitRegister(reg,val);
                        PC += 3;
                        cycles += 12;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x02){ //LD pointer reg, A
                        var reg = Math.floor(opcode / 0x10);
                        this.setIndexedPointerRegister(reg,this.getA());
                        PC += 1;
                        cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x03){ //INC 16bit register
                        var reg = Math.floor(opcode / 0x10);
                        this.setIndexed16BitRegister(reg,this.getIndexed16BitRegister(reg) + 1);
                        PC += 1;
                        cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x04){ //INC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2;
                        var data = this.getIndexed8BitRegister(reg) + 1;
                        data &= 0xFF;
                        this.setSubtract(false);
                        this.setZero(data == 0);
                        this.setHalfCarry((data & 0x0F) == 0);
                        this.setIndexed8BitRegister(reg,data);
                        PC += 1;
                        cycles += 4;
                        if (reg == 6)
                            cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x05){ //DEC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2;
                        var data = this.getIndexed8BitRegister(reg) - 1;
                        data &= 0xFF;
                        this.setSubtract(true);
                        this.setZero(data == 0);
                        this.setHalfCarry((data & 0x0F) == 0x0F);
                        this.setIndexed8BitRegister(reg,data);
                        PC += 1;
                        cycles += 4;
                        if (reg == 6)
                            cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x06){//LD 8bitreg, nn
                        var reg = Math.floor(opcode / 0x10) * 2;
                        var val = memoryController.readByte(PC + 1);
                        this.setIndexed8BitRegister(reg,val);
                        PC += 2;
                        cycles += 8;
                        if (reg == 6)
                            cycles += 4;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x09){ //ADD HL, 16bitreg
                        var reg = Math.floor(opcode / 0x10);
                        var regData = this.getIndexed16BitRegister(reg);
                        var data = (regData + HL) & 0xFFFF;
                        this.setHalfCarry(((HL^regData^data) & 0x1000) != 0);
                        this.setCarry(((HL + regData) & 0x10000) != 0);
                        this.setSubtract(false);
                        HL = data;
                        PC += 1;
                        cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x0A){ //LD A, pointer register
                        var reg = Math.floor(opcode / 0x10);
                        this.setA(this.getIndexedPointerRegister(reg));
                        PC += 1;
                        cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x0B){ //DEC 16bit register
                        var reg = Math.floor(opcode / 0x10);
                        this.setIndexed16BitRegister(reg,this.getIndexed16BitRegister(reg) - 1);
                        PC += 1;
                        cycles += 8;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x0C){ //INC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2 + 1;
                        var data = this.getIndexed8BitRegister(reg) + 1;
                        data &= 0xFF;
                        this.setSubtract(false);
                        this.setZero(data == 0);
                        this.setHalfCarry((data & 0x0F) == 0);
                        this.setIndexed8BitRegister(reg,data);
                        PC += 1;
                        cycles += 4;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x0D){ //DEC 8bitreg
                        var reg = Math.floor(opcode / 0x10) * 2 + 1;
                        var data = this.getIndexed8BitRegister(reg) - 1;
                        data &= 0xFF;
                        this.setSubtract(true);
                        this.setZero(data == 0);
                        this.setHalfCarry((data & 0x0F) == 0x0F);
                        this.setIndexed8BitRegister(reg,data);
                        PC += 1;
                        cycles += 4;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x0E){ //LD 8bitreg, nn
                        var reg = Math.floor(opcode / 0x10) * 2 + 1;
                        var val = memoryController.readByte(PC + 1);
                        this.setIndexed8BitRegister(reg,val);
                        PC += 2;
                        cycles += 8;
                        break;
                    }
                }
                else if (opcode >= 0xC0){
                        if ((opcode & 0x0F) == 0x01){//pop 16 bit register
                        var reg = Math.floor((opcode - 0xC0) / 0x10);
                        var val = memoryController.readWord(SP);
                        if (reg == 3){
                            AF = val & 0xFFF0;
                        }
                        else{
                            this.setIndexed16BitRegister(reg,val);
                        }
                        SP+= 2;
                        PC += 1;
                        cycles += 12;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x05){//push 16 bit register
                        var reg = Math.floor((opcode - 0xC0) / 0x10);
                        var val;
                        if (reg == 3){
                            val = AF;
                        }
                        else{
                            val = this.getIndexed16BitRegister(reg);
                        }
                        SP -= 2;
                        memoryController.writeWord(SP,val);
                        PC += 1;
                        cycles += 16;
                        break;
                    }
                    else if ((opcode & 0x0F) == 0x07 || (opcode & 0x0F) == 0x0F){//RST calls
                        PC += 1;
                        call(opcode - 0xC7);
                        cycles += 16;
                        break;
                    }
                }
                else if (opcode >= 0x40 && opcode <= 0x7F && opcode != 0x76){//LD 8bitregister, 8bitregister
                    var reg1 = Math.floor((opcode - 0x40) / 0x08);
                    var reg2 = opcode - 0x40 - reg1 * 0x08;
                    if (reg1 == 6 || reg2 == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    this.setIndexed8BitRegister(reg1,this.getIndexed8BitRegister(reg2));
                    PC += 1;
                    break;
                }
                else if (opcode >= 0x80 && opcode <= 0x87){ //ADD A, 8bit register
                    var registerIndex = opcode - 0x80;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    var value = this.getA() + this.getIndexed8BitRegister(registerIndex);
                    this.setSubtract(false);
                    this.setCarry((value & 0xFF00) != 0);
                    this.setHalfCarry(((this.getA()^this.getIndexed8BitRegister(registerIndex)^(value & 0xFF)) & 0x10) != 0);
                    this.setA(value);
                    this.setZero(this.getA() == 0);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0x88 && opcode <= 0x8F){ //ADC A, 8bit register
                    var registerIndex = opcode - 0x88;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    var value = this.getA() + this.getIndexed8BitRegister(registerIndex) + (this.getCarry() ? 1:0);
                    this.setSubtract(false);
                    this.setCarry((value & 0xFF00) != 0);
                    this.setHalfCarry(((this.getA()^this.getIndexed8BitRegister(registerIndex)^(value & 0xFF)) & 0x10) != 0);
                    this.setA(value);
                    this.setZero(this.getA() == 0);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0x90 && opcode <= 0x97){ //SUB A, 8bit register
                    var registerIndex = opcode - 0x90;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    var value = this.getA();
                    value -= this.getIndexed8BitRegister(registerIndex);
                    value &= 0xFFFF;
                    this.setCarry((value & 0xFF00) != 0);
                    this.setHalfCarry(((this.getA()^this.getIndexed8BitRegister(registerIndex)^(value & 0xFF)) & 0x10) != 0);
                    this.setSubtract(true);
                    this.setA(value);
                    this.setZero(this.getA() == 0);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0x98 && opcode <= 0x9F){ //SBC A, 8bit register
                    var registerIndex = opcode - 0x98;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    var value = this.getA();
                    value -= this.getIndexed8BitRegister(registerIndex) + (this.getCarry() ? 1:0);
                    value &= 0xFFFF;
                    this.setCarry((value & 0xFF00) != 0);
                    this.setHalfCarry(((this.getA()^this.getIndexed8BitRegister(registerIndex)^(value & 0xFF)) & 0x10) != 0);
                    this.setSubtract(true);
                    this.setA(value);
                    this.setZero(this.getA() == 0);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0xA0 && opcode <= 0xA7){ //AND A, 8bit register
                    var registerIndex = opcode - 0xA0;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    this.setA(this.getA() & this.getIndexed8BitRegister(registerIndex));
                    this.setZero(this.getA() == 0);
                    this.setSubtract(false);
                    this.setCarry(false);
                    this.setHalfCarry(true);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0xA8 && opcode <= 0xAF){ //XOR A, 8bit register
                    var registerIndex = opcode - 0xA8;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    this.setA(this.getA() ^ this.getIndexed8BitRegister(registerIndex));
                    this.setZero(this.getA() == 0);
                    this.setSubtract(false);
                    this.setCarry(false);
                    this.setHalfCarry(false);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0xB0 && opcode <= 0xB7){ //OR A, 8bit register
                    var registerIndex = opcode - 0xB0;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    this.setA(this.getA() | this.getIndexed8BitRegister(registerIndex));
                    this.setZero(this.getA() == 0);
                    this.setSubtract(false);
                    this.setCarry(false);
                    this.setHalfCarry(false);
                    PC += 1;
                    break;
                }
                else if (opcode >= 0xB8 && opcode <= 0xBF){ //CP A, 8bit register
                    var registerIndex = opcode - 0xB8;
                    if (registerIndex == 6)
                        cycles += 8;
                    else
                        cycles += 4;
                    var a = this.getA();
                    var value = this.getIndexed8BitRegister(registerIndex);
                    this.setSubtract(true);
                    this.setZero(a == value);
                    this.setCarry(a < value);
                    this.setHalfCarry((a & 0x0F) < (value & 0x0F));
                    PC += 1;
                    break;
                }
                console.error("Unrecognized opcode encountered: 0x" + opcode.toString(16).toUpperCase());
            }
        }
        return cycles;
    }

    CPUEmulator.executeCBInstruction = function(){
        var opcode = memoryController.readByte(PC+1);
        if (opcode >= 0xC0){ //SET
            var num = Math.floor((opcode - 0xC0) / 0x08);
            var registerIndex = opcode - 0xC0 - num * 0x08;
            this.setIndexed8BitRegister(registerIndex,this.getIndexed8BitRegister(registerIndex) | (1 << num));
        }
        else if (opcode >= 0x80){ //RES
            var num = Math.floor((opcode - 0x80) / 0x08);
            var registerIndex = opcode - 0x80 - num * 0x08;
            this.setIndexed8BitRegister(registerIndex, this.getIndexed8BitRegister(registerIndex) & ~(1 << num));
        }
        else if (opcode >= 0x40){//BIT
            var num = Math.floor((opcode - 0x40) / 0x08);
            var registerIndex = opcode - 0x40 - num * 0x08;
            this.setSubtract(false);
            this.setHalfCarry(true);
            this.setZero((this.getIndexed8BitRegister(registerIndex) & (1 << num)) == 0);
        }
        else if (opcode >= 0x38){//SRL
            var registerIndex = opcode - 0x38;
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setCarry((this.getIndexed8BitRegister(registerIndex) & 0x01) != 0);
            this.setIndexed8BitRegister(registerIndex, this.getIndexed8BitRegister(registerIndex) >>> 1);
            this.setZero(this.getIndexed8BitRegister(registerIndex) == 0);
        }
        else if (opcode >= 0x30){//SWAP
            var registerIndex = opcode - 0x30;
            this.setSubtract(false);
            this.setCarry(false);
            this.setHalfCarry(false);
            var data = this.getIndexed8BitRegister(registerIndex);
            data = ((data & 0x0F) << 4) | ((data >>> 4) & 0x0F);
            this.setIndexed8BitRegister(registerIndex,data);
            this.setZero(data == 0);
        }
        else if (opcode >= 0x28){// SRA
            var registerIndex = opcode - 0x28;
            var data = this.getIndexed8BitRegister(registerIndex);
            this.setCarry((data & 0x01) != 0);
            data = (data >>> 1) | (data & 0x80);
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setZero(data == 0);
            this.setIndexed8BitRegister(registerIndex,data);
        }
        else if (opcode >= 0x20){// SLA
            var registerIndex = opcode - 0x20;
            var data = this.getIndexed8BitRegister(registerIndex);
            this.setCarry((data & 0x80) != 0);
            data = (data << 1) & 0xFF;
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setZero(data == 0);
            this.setIndexed8BitRegister(registerIndex,data);
        }
        else if (opcode >= 0x18){// RR
            var registerIndex = opcode - 0x18;
            var data = this.getIndexed8BitRegister(registerIndex);
            data >>>= 1;
            if (this.getCarry())
                data |= 0x80;
            this.setCarry((this.getIndexed8BitRegister(registerIndex) & 0x01) != 0);
            this.setZero(data == 0);
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setIndexed8BitRegister(registerIndex,data);
        }
        else if (opcode >= 0x10){// RL
            var registerIndex = opcode - 0x10;
            var data = this.getIndexed8BitRegister(registerIndex);
            data <<= 1;
            data &= 0xFF;
            if (this.getCarry())
                data |= 1;
            this.setCarry((this.getIndexed8BitRegister(registerIndex) & 0x80) != 0);
            this.setZero(data == 0);
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setIndexed8BitRegister(registerIndex,data);
        }
        else if (opcode >= 0x08){// RRC
            var registerIndex = opcode - 0x08;
            var data = this.getIndexed8BitRegister(registerIndex);
            this.setCarry((data & 0x01) != 0);
            data = ((data >>> 1) | (data << 7)) & 0xFF;
            this.setZero(data == 0);
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setIndexed8BitRegister(registerIndex,data);
        }
        else{// RLC
            var registerIndex = opcode;
            var data = this.getIndexed8BitRegister(registerIndex);
            this.setCarry((data & 0x80) != 0);
            data = (data << 1) | (data >>> 7);
            data &= 0xFF;
            this.setZero(data == 0);
            this.setSubtract(false);
            this.setHalfCarry(false);
            this.setIndexed8BitRegister(registerIndex,data);
        }
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

    return CPUEmulator;

});
