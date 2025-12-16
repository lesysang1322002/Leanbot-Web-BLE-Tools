#include <Leanbot.h>
 
 
void setup() {
  Leanbot.begin();                    // initialize Leanbot
}
 
 
void loop() {
  LbRGB[ledO] = CRGB::Red;           // red settings
  LbRGB.show();                      // LED shows up
  LbDelay(1000);                     // light time
 
  LbRGB[ledO] = CRGB::Black;         // black settings
  LbRGB.show();                      // LED shows up
  LbDelay(1000);                     // light time
}