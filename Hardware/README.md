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

Maybe for IR can use one with cable like here? https://www.aliexpress.com/wholesale?catId=0&initiative_id=SB_20180612091442&SearchText=ir+receiver

About Sonar - HC-SR04 is suitable?

About electret microphone - something like this is suitable? 
https://www.aliexpress.com/item/5-pcs-Electret-Condenser-MIC-Capacitive-Electret-Microphone-4mm-x-1-5mm-for-PC-Phone-MP3/32829007764.html

About loudspeaker - something like this is suitable?
https://www.aliexpress.com/item/2-Pcs-Set-4ohm-3w-40mm-antimagnetic-Speaker-small-Sound-accessories-loudspeaker-Woofer-Column-Speaker-Drop/32842044338.html
https://www.aliexpress.com/item/GHXAMP-8OHM-20W-Car-Tweeter-Speaker-Silk-Film-High-end-Neodymium-Steel-Magnetic-Small-Treble-Loudspeaker/32838332520.html
https://www.aliexpress.com/item/LEORY-3Inch-2Pcs-Loudspeaker-Passive-Bass-Vibrating-Speaker-3W-4Ohm-Small-DIY-Professional-Lound-Speaker-for/32837465433.html
https://www.aliexpress.com/item/Loudspeaker-Ultra-thin-small-speaker-Diameter-36MM-Thickness-5mm/32791708064.html
https://www.aliexpress.com/item/GHXAMP-8OHM-2W-TV-Speaker-Mini-Small-Loudspeakers-LCD-TV-one-machine-Speakers-Repairs-DIY-1/32832481312.html
https://www.aliexpress.com/item/20pcs-1W8R-1-watt-8-ohm-speaker-small-original-AAC-DVD-speaker-diameter-18mm-1-25MM/32702115727.html
https://www.aliexpress.com/item/Free-shipping-10pcs-Mobile-DVD-EVD-Small-Speaker-8R2W-2W-8R-8-Euro-Diameter-40MM-4cm/32804104687.html
https://www.aliexpress.com/wholesale?catId=0&initiative_id=SB_20180612085700&SearchText=small+loudspeaker+with+cable

Or this for microhone:
https://www.aliexpress.com/item/5PC-Lot-4-1-5mm-5-5CM-length-Electret-Condenser-Microphone-MIC-Capsule-2-Leads/32658064027.html

HC-SR04 is suitable, but there is also version with higher precision HC-SR05.

Microphones seams good but advice is to test it.

All referenced speakers can be used, except ones with power below 2W. Usually bigger size sounds better, but some users may need compact size, so order and test few of them. 

Fo IR I recommend to use 2.54 male to female bridge 3-wire cable if someone wants to attach TSOP through hole off board, or wires with one open end so user can solder to Receiver.

NTC temperature sensor - It is just possibility for robotic applications that needs precise temperature measurements, for example attached on some servo controlled probe, because on board sensors and heated on board and are not precise. Maybe can, but recommended is NTC 10KOhm, B constant 3435

NTC Cable is part from Vishay, but without connector:
http://uk.farnell.com/vishay/ntcle413e2103f102l/thermistor-ntc-10kohm-wire-leaded/dp/2492885?CMP=i-ddd7-00001003
However they offer length customisation and connector attachment on request according to datasheet.

It can be powered from PiJuice gpio 5V, also it is possible to use VSys output and connect to 4WD battery input for boosting to higher voltage than 5V.It is wire cable with 2.54 female connectors, or open wires on 4WD side if using terminal instead of header.  Power cable should have total resistance less than 10mOhm. For AWG 22 it can be up to 20cm for AWG 25 up to 10 cm.
