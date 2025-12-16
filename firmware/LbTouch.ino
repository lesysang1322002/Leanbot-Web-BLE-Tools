#include <Leanbot.h>
 
void setup() {
  Leanbot.begin();                    // initialize Leanbot
}
 
void loop() {
  int value1A = LbTouch.read(TB1A);
 
  if (value1A == HIGH) {
    LbMotion.runLR(500, 0);
  }
}