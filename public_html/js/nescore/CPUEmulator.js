define(function(){
    var CPUEmulator = {};

    var A, X, Y,PC, S, P;
    var memoryController;

    CPUEmulator.setMemoryController = function(m){
        memoryController = m;
    }

    function setCarry(s){
        if (s){
            P |= 1;
        }
        else{
            P &= ~1;
        }
    }

    function getCarry(){
        return P & 1 != 0;
    }

    function setZero(s){
        if (s){
            P |= 2;
        }
        else{
            P &= ~2;
        }
    }

    function getZero(){
        return P & 2 != 0;
    }

    function setIRQDisable(s){
        if (s){
            P |= 4;
        }
        else{
            P &= ~4;
        }
    }

    function getIRQDisable(){
        return P & 4 != 0;
    }

    function setDecimalMode(s){
        if (s){
            P |= 8;
        }
        else{
            P &= ~8;
        }
    }

    function getDecimalMode(){
        return P & 8 != 0;
    }

    function setBreakFlag(s){
        if (s){
            P |= 16;
        }
        else{
            P &= ~16;
        }
    }

    function getBreakFlag(){
        return P & 16 != 0;
    }

    function setOverflow(s){
        if (s){
            P |= 64;
        }
        else{
            P &= ~64;
        }
    }

    function getOverflow(){
        return P & 64 != 0;
    }

    function setSign(s){
        if (s){
            P |= 128;
        }
        else{
            P &= ~128;
        }
    }

    function getSign(){
        return P & 128 != 0;
    }

    function push(value){
        memoryController.writeByte(S,A);
        S -= 1;
        S = 0x100 | (S & 0xFF);
    }

    function pushWord(value){
        push(value >> 8);
        push(value);
    }

    function pop(){
        S += 1;
        S = 0x100 | (S  & 0xFF);
        return memoryController.readByte(S)
    }

    function popWord(){
        return pop() | (pop() << 8);
    }

    CPUEmulator.reset = function(){
        A = 0;
        X = 0;
        Y = 0;
        PC = 0;
        S = 0;
        P = 0;
    }

    CPUEmulator.executeNextInstruction = function(){
        var cycles = 0;
        var opcode = memoryController.readByte(PC++);
        var address = null;
        var crossBoundary = false;
        var compoundLookup = false;
        var memoryCycles = 0;
        switch (opcode & 0x1F){//figure out the addressing mode
            case 0x01://(nn,X)
                address = memoryController.readWord(memoryController.readByte(PC++) + X);
                memoryCycles += 4;
                break;
            case 0x04:
            case 0x05:
            case 0x06://nn
                address = memoryController.readByte(PC++);
                memoryCycles += 1;
                break;
            case 0x00:
            case 0x02:
            case 0x09://#nn (immediate)
                address = PC++;
                break;
            case 0x0C:
            case 0x0D:
            case 0x0E://nnnn
                address = memoryController.readWord(PC);
                PC += 2;
                memoryCycles += 2;
                break;
            case 0x11://(nn)+Y
                address = memoryController.readWord(memoryController.readByte(PC++));
                var newAddress = address + Y;
                crossBoundary = (address & 0xFF00) != (newAddress & 0xFF00);
                compoundLookup = true;
                address = newAddress;
                memoryCycles += 3;
                break;
            case 0x14:
            case 0x15:
            case 0x16://nn+X
                address = memoryController.readByte(PC++) + X;
                address &= 0xFF;
                memoryCycles += 2;
                break;
            case 0x19://nnnn+Y
                address = memoryController.readWord(PC);
                var newAddress = address + Y;
                crossBoundary = (address & 0xFF00) != (newAddress & 0xFF00);
                compoundLookup = true;
                address = newAddress;
                PC += 2;
                memoryCycles += 2;
                break;
            case 0x1C:
            case 0x1D:
            case 0x1E://nnnn+X
                address = memoryController.readWord(PC);
                var newAddress = address + X;
                crossBoundary = (address & 0xFF00) != (newAddress & 0xFF00);
                compoundLookup = true;
                address = newAddress;
                PC += 2;
                memoryCycles += 2;
                break;
        }
        switch (opcode){
            case 0x8A://TXA
                A = X;
                setZero(A == 0);
                setSign((A & 0x80) != 0);
                cycles += 2;
                break;
            case 0x98://TXS
                S = X;
                cycles += 2;
                break;
            case 0x98://TYA
                A = Y;
                setZero(A == 0);
                setSign((A & 0x80) != 0);
                cycles += 2;
                break;
            case 0xA0://MOV Y,nn
                Y = memoryController.readByte(address);
                setZero(Y == 0);
                setSign((Y & 0x80) != 0);
                cycles += 2;
                break;
            case 0xA2://MOV X,nn
                X = memoryController.readByte(address);
                setZero(X == 0);
                setSign((X & 0x80) != 0);
                cycles += 2;
                break;
            case 0xA8://TAY
                Y = A;
                setZero(Y == 0);
                setSign((Y & 0x80) != 0);
                cycles += 2;
                break;
            case 0xA9://MOV A,nn
                A = memoryController.readByte(address);
                setZero(A == 0);
                setSign((A & 0x80) != 0);
                cycles += 2;
                break;
            case 0xAA://TAX
                X = A;
                setZero(X == 0);
                setSign((X & 0x80) != 0);
                cycles += 2;
                break;
            case 0xBA://TSX
                X = S;
                setZero(X == 0);
                setSign((X & 0x80) != 0);
                cycles += 2;
                break;
            case 0xA5:
            case 0xB5:
            case 0xAD:
            case 0xBD:
            case 0xB9:
            case 0xA1:
            case 0xB1://LDA
                A = memoryController.readByte(address);
                setZero(A == 0);
                setSign ((A & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0xA6:
            case 0xB6:
            case 0xAE:
            case 0xBE://LDX
                X = memoryController.readByte(address);
                setZero(X == 0);
                setSign ((X & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0xA4:
            case 0xB4:
            case 0xAC:
            case 0xBC://LDY
                Y = memoryController.readByte(address);
                setZero(Y == 0);
                setSign ((Y & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0x85:
            case 0x95:
            case 0x8D:
            case 0x9D:
            case 0x99:
            case 0x81:
            case 0x91://STA
                memoryController.writeByte(address,A);
                cycles += memoryCycles + (compoundLookup ? 3 : 2);
                break;
            case 0x86:
            case 0x96:
            case 0x8E://STX
                memoryController.writeByte(address,X);
                cycles += memoryCycles + (compoundLookup ? 3 : 2);
                break;
            case 0x84:
            case 0x94:
            case 0x8C://STY
                memoryController.writeByte(address,Y);
                cycles += memoryCycles + (compoundLookup ? 3 : 2);
                break;
            case 0x48://PHA
                push(A);
                cycles += 3;
                break;
            case 0x08://PHP
                push(P);
                cycles += 3;
                break;
            case 0x68://PLA
                A = pop();
                setZero(A == 0);
                setSign((A & 0x80) != 0);
                cycles += 4;
                break;
            case 0x28://PLP
                P = pop();
                setBreakFlag(true);
                setDecimalMode(true);
                cycles += 4;
                break;
            case 0x69:
            case 0x65:
            case 0x75:
            case 0x6D:
            case 0x7D:
            case 0x79:
            case 0x61:
            case 0x71://ADC
                var operand = memoryController.readByte(address);
                var result = A + operand + (getCarry() ? 1 : 0);
                setOverflow(((A ^ operand) & 0x80) == 0 && ((A ^ result) & 0x80) != 0);
                setCarry((result & 0x100) != 0);
                A = result & 0xFF;
                setSign((A & 0x80) != 0);
                setZero(A == 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0xE9:
            case 0xE5:
            case 0xF5:
            case 0xED:
            case 0xFD:
            case 0xF9:
            case 0xE1:
            case 0xF1://SBC
                var operand = memoryController.readByte(address);
                var result = A - operand - (getCarry() ? 0 : 1);
                setOverflow(((A ^ operand) & 0x80) != 0 && ((A ^ result) & 0x80) != 0);
                setCarry((result & 0x100) == 0);
                A = result & 0xFF;
                setZero(A == 0);
                setSign((A & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0x29:
            case 0x25:
            case 0x35:
            case 0x2D:
            case 0x3D:
            case 0x39:
            case 0x21:
            case 0x31://AND
                A &= memoryController.readByte(address);
                setZero(A == 0);
                setCarry((A & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0x49:
            case 0x45:
            case 0x55:
            case 0x4D:
            case 0x5D:
            case 0x59:
            case 0x41:
            case 0x51://EOR
                A ^= memoryController.readByte(address);
                setZero(A == 0);
                setCarry((A & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0x09:
            case 0x05:
            case 0x15:
            case 0x0D:
            case 0x1D:
            case 0x19:
            case 0x01:
            case 0x11://OR
                A |= memoryController.readByte(address);
                setZero(A == 0);
                setCarry((A & 0x80) != 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0xC9:
            case 0xC5:
            case 0xD5:
            case 0xCD:
            case 0xDD:
            case 0xD9:
            case 0xC1:
            case 0xD1://CMP
                var result = A - memoryController.readByte(address);
                setCarry((result & 0x100) == 0);
                setSign((result & 0x80) != 0);
                setZero((result & 0xFF) == 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0xE0:
            case 0xE4:
            case 0xEC://CPX
                var result = X - memoryController.readByte(address);
                setCarry((result & 0x100) == 0);
                setSign((result & 0x80) != 0);
                setZero((result & 0xFF) == 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0xC0:
            case 0xC4:
            case 0xCC://CPY
                var result = Y - memoryController.readByte(address);
                setCarry((result & 0x100) == 0);
                setSign((result & 0x80) != 0);
                setZero((result & 0xFF) == 0);
                cycles += memoryCycles + (crossBoundary ? 3 : 2);
                break;
            case 0x24:
            case 0x2C://BIT
                var operand = memoryController.readByte(address);
                setZero((A & operand) == 0);
                setSign((operand & 0x80) != 0);
                setOverflow((operand & 0x40) != 0);
                cycles += memoryCycles + 2;
                break;
            case 0xE6:
            case 0xF6:
            case 0xEE:
            case 0xFE://INC
                var result = memoryController.readByte(address) + 1;
                result &= 0xFF;
                setZero(result == 0);
                setSign((result & 0x80) != 0);
                memoryController.writeByte(address,result);
                cycles += memoryCycles + 4;
                break;
            case 0xE8://INX
                X += 1;
                X &= 0xFF;
                setZero(X == 0);
                setSign((X & 0x80) != 0);
                cycles += 2;
                break;
            case 0xC8://INY
                Y += 1;
                Y &= 0xFF;
                setZero(Y == 0);
                setSign((Y & 0x80) != 0);
                cycles += 2;
                break;
            case 0xC6:
            case 0xD6:
            case 0xCE:
            case 0xDE://DEC
                var result = memoryController.readByte(address) - 1;
                result &= 0xFF;
                setZero(result == 0);
                setSign((result & 0x80) != 0);
                memoryController.writeByte(address,result);
                cycles += memoryCycles + 4;
                break;
            case 0xE8://DEX
                X -= 1;
                X &= 0xFF;
                setZero(X == 0);
                setSign((X & 0x80) != 0);
                cycles += 2;
                break;
            case 0xC8://DEY
                Y -= 1;
                Y &= 0xFF;
                setZero(Y == 0);
                setSign((Y & 0x80) != 0);
                cycles += 2;
                break;
            case 0x0A://ASL A
                var result = A << 1;
                setCarry((result & 0x100) == 0);
                A = result & 0xFF;
                setZero(A == 0);
                setSign((A & 0x80) == 0);
                cycles += 2;
                break;
            case 0x06:
            case 0x16:
            case 0x0E:
            case 0x1E://ASL
                var result = memoryController.readByte(address) << 1;
                setCarry((result & 0x100) == 0);
                result &= 0xFF;
                setZero(result == 0);
                setSign((result & 0x80) == 0);
                memoryController.writeByte(address,result)
                cycles += 4 + memoryCycles;
                break;
            case 0x4A://LSR A
                setCarry((A & 1) == 1);
                A >>= 1;
                setZero(A == 0);
                setSign(false);
                cycles += 2;
                break;
            case 0x46:
            case 0x56:
            case 0x4E:
            case 0x5E://LSR
                var result = memoryController.readByte(address);
                setCarry((result & 1) == 1);
                result >>= 1;
                setZero(result == 0);
                setSign(false);
                memoryController.writeByte(address,result);
                cycles += 4 + memoryCycles;
                break;
            case 0x2A://ROL A
                var result = (A << 1) | (getCarry() ? 1 : 0);
                setCarry((result & 0x100) == 0);
                A = result & 0xFF;
                setZero(A == 0);
                setSign((A & 0x80) == 0);
                cycles += 2;
                break;
            case 0x26:
            case 0x36:
            case 0x2E:
            case 0x3E://ROL
                var result = (memoryController.readByte(address) << 1) | (getCarry() ? 1 : 0);
                setCarry((result & 0x100) == 0);
                result &= 0xFF;
                setZero(result == 0);
                setSign((result & 0x80) == 0);
                memoryController.writeByte(address,result);
                cycles += 4 + memoryCycles;
                break;
            case 0x2A://ROR A
                var carry = getCarry();
                setCarry((A & 1) == 1);
                A >>= 1;
                A |= carry ? 0x80 : 0;
                setZero(A == 0);
                setSign(carry);
                cycles += 2;
                break;
            case 0x66:
            case 0x76:
            case 0x6E:
            case 0x7E://ROR
                var carry = getCarry();
                var result = memoryController.readByte(address);
                setCarry((result & 1) == 1);
                result >>= 1;
                result |= carry ? 0x80 : 0;
                setZero(result == 0);
                setSign(carry);
                memoryController.writeByte(address,result);
                cycles += 4 + memoryCycles;
                break;
            case 0x4C:
                PC = address;
                cycles += 3;
                break;
            case 0x6C:
                PC = memoryController.readWord(address);
                cycles += 5;
                break;
            case 0x20://JSR
                pushWord(PC - 1);
                PC = address;
                cycles += 6;
                break;
            case 0x40://RTI
                P = pop();
                PC = popWord();
                setBreakFlag(true);
                setDecimalMode(true);
                cycles += 6;
                break;
            case 0x60://RTS
                PC = popWord() + 1;
                cycles += 6;
                break;
            case 0x10://BPL
                cycles += 2;
                if (!getSign()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0x30://BMI
                cycles += 2;
                if (getSign()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0x50://BVC
                cycles += 2;
                if (!getOverflow()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0x70://BVS
                cycles += 2;
                if (getOverflow()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0x90://BCC/BLT
                cycles += 2;
                if (!getCarry()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0xB0://BCS/BGE
                cycles += 2;
                if (getCarry()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0xD0://BNE/BZC
                cycles += 2;
                if (!getZero()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0xF0://BNE/BZC
                cycles += 2;
                if (getZero()){
                    var target = PC - 2 + memoryController.readSignedByte(address);
                    cycles += (target & 0xFF00) != (PC & 0xFF00) ? 2 : 1;
                    PC = target;
                }
                break;
            case 0x00://BRK
                setBreakFlag(true);
                pushWord(PC);
                push(P);
                setIRQDisable(true);
                PC = memoryController.readWord(0xFFFE);
                break;
            case 0x18://CLC
                setCarry(false);
                cycles += 2;
                break;
            case 0x58://CLI
                setIRQDisable(false);
                cycles += 2;
                break;
            case 0xD8://CLD
                setDecimalMode(false);
                cycles += 2;
                break;
            case 0xB8://CLV
                setOverflow(false);
                cycles += 2;
                break;
            case 0x38://SEC
                setCarry(true);
                cycles += 2;
                break;
            case 0x78://SEI
                setIRQDisable(true);
                cycles += 2;
                break;
            case 0xF8://SED
                setDecimalMode(true);
                cycles += 2;
                break;
            case 0xEA://NOP
                cycles += 2;
                break;
        }
    }

    return CPUEmulator;
});