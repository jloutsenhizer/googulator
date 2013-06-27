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
        for (var i = 0, li = state.length; i < li; i++){
            this.state[i] = new Array(8);
            for (var j = 0, lj = state[i].length; j < lj; j++){
                this.state[i][j] = this.KEY_NOT_PRESSED;
            }
        }
    };

    Joypad.prototype = {
        setKey: function(player, key, value) {
            this.state[player][key] = value;
        },
        keys: {
            KEY_A: 0,
            KEY_B: 1,
            KEY_SELECT: 2,
            KEY_START: 3,
            KEY_UP: 4,
            KEY_DOWN: 5,
            KEY_LEFT: 6,
            KEY_RIGHT: 7
        },
        KEY_PRESSED: 0x41,
        KEY_NOT_PRESSED: 0x40,
        PLAYER_1: 0,
        PLAYER_2: 1
    };

    return Joypad;

});
