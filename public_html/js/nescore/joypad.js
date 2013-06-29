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

// Keyboard events are bound in the UI
define([],function(){
    var Joypad = function() {
        this.state = new Array(2);
        for (var i = 0, li = this.state.length; i < li; i++){
            this.state[i] = new Uint16Array(11);
            for (var j = 0, lj = this.state[i].length; j < lj; j++){
                this.state[i][j] = this.BUTTON_NOT_PRESSED;
            }
        }
    };

    Joypad.prototype = {
        setButtonState: function(player, key, value) {
            this.state[player][key] = value;
        },
        BUTTON_A: 0,
        BUTTON_B: 1,
        BUTTON_SELECT: 2,
        BUTTON_START: 3,
        BUTTON_UP: 4,
        BUTTON_DOWN: 5,
        BUTTON_LEFT: 6,
        BUTTON_RIGHT: 7,
        BUTTON_ZAPPER: 8,
        BUTTON_PRESSED: 0x01,
        BUTTON_NOT_PRESSED: 0x00,
        ZAPPER_X: 9,
        ZAPPER_Y: 10,
        PLAYER_1: 0,
        PLAYER_2: 1
    };

    return Joypad;

});
