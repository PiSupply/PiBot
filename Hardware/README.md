# Hardware

Recommended speaker: 8Ohm, Max rms power >= 2W,
Electret type microphone.
2WD and 4WD have ADC input for connection of analog output sensors they need, ADC input range is 0 - 3.3V.

This pan/tilt about to attach with LED panel: https://www.robotshop.com/en/lynxmotion-pan-and-tilt-kit-aluminium2.html

5 is sufficient. For me 2 samples.

There is amp on HAT and speaker is to be attached with cable to 2.54mm header.

Camera panel has purpose to adopt camera mechanics to pan-tilt mechanics with appropriate shape and screw holes. No LED driver on this board, driver is on main board and provided on connector P4, same signals intended for servo drive also. There is mosfets on this boards that amplifies LED currents, and can be configured with additional resistor to drive high brightness smd white LEDs, for example 2 x 250 mA. Through hole LEDs are limited to 20 mA only.

Pibot 4WD: 12mm spacers.
Pibot 2WD: 9mm no stacker, 14mm using stacker header.
Pibot Zero: 8mm spacers.
