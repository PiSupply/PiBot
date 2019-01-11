SRC=robocar.cpp ../../lib/pibot.cpp
HEADERS=../../lib/pibot.h
INC_DIR = ../../lib
LDFLAGS= -lwiringPi -llirc_client
CXXFLAGS= -std=c++11 -I$(INC_DIR)

robocar: ${SRC} ${HEADERS}
	${CXX} -g -o $@ ${SRC} ${LDFLAGS} ${CXXFLAGS}

.phony:
clean:
	rm robocar
