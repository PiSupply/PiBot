/*****************************************************************
File: bottest.cpp
Version: 1.0

Author: Milan Neskovic 2016-2018, milan@pi-supply.com

Description:
	C++ example code for PiBot Boards based Robot.

Copyright:

	This program is free software; you can redistribute it and/or
	modify it under the terms of the GNU General Public License
	as published by the Free Software Foundation; version 3 of the
	License.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
******************************************************************/

#include "pibot.h"
#include <iostream>
#include <unistd.h>
#include <wiringPi.h>
#include <sys/ioctl.h>
#include <atomic>
#include <signal.h>
#include <cstring>
#include <termios.h>
#include <fcntl.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <math.h>
#include <sstream>

using namespace std;
using namespace pibot;

enum PiBotBoard {PIBOT_4WD, PIBOT_2WD, PIBOT_ZERO};
enum RobotCommand {NO_COMMAND, STOP, SPEED_UP_FORWARD, SPEED_UP_BACKWARD, TURN_LEFT, TURN_RIGHT};

std::atomic<bool> _quit(false);    // signal flag

struct termios orig_ttystate;

void kb_nonblock(bool enable)
{
    struct termios ttystate;
    //get the terminal state
    tcgetattr(STDIN_FILENO, &ttystate);
 
    if (enable) {
		// take copiy for restore on exit
		tcgetattr(0, &orig_ttystate);
        //turn off canonical mode
        ttystate.c_lflag &= (~ICANON & ~ECHO);
        //minimum of number input read.
        ttystate.c_cc[VMIN] = 1;
		//cfmakeraw(&ttystate);
		tcsetattr(STDIN_FILENO, TCSANOW, &ttystate);
		system("setterm -cursor off");
    } else {
		system("setterm -cursor on");
        //turn on canonical mode
		tcsetattr(0, TCSANOW, &orig_ttystate);
    }
}

int kbhit()
{
    struct timeval tv;
    fd_set fds;
    tv.tv_sec = 0;
    tv.tv_usec = 0;
    FD_ZERO(&fds);
    FD_SET(STDIN_FILENO, &fds); //STDIN_FILENO is 0
    select(STDIN_FILENO+1, &fds, NULL, NULL, &tv);
    return FD_ISSET(STDIN_FILENO, &fds);
}

int LircOpen(char *name) {
	int fd=socket(AF_UNIX,SOCK_STREAM,0);
	if(fd==-1) return fd;
	struct sockaddr_un addr;
	addr.sun_family=AF_UNIX;
	strcpy(addr.sun_path,name);
	if(connect(fd,(struct sockaddr *) &addr,sizeof(addr))==-1) {
		close(fd);
		return(-1);
	}
	fcntl(fd,F_SETOWN,getpid());
	int flags=fcntl(fd,F_GETFL,0);
	if(flags!=-1) fcntl(fd,F_SETFL,flags|O_NONBLOCK);
	return fd;
}

int LircClose(int fd) {
	if (fd!=-1) {
		shutdown(fd,2);
		close(fd);
	}
}

string LircGetKey(int fd) {
	static char msg[256];
	int ret=read(fd,msg,256);
	if (ret > 0) {
		string code,press,key,remote;
		stringstream(msg) >> code >> press >> key >> remote;
		return key;
	} else {
		return "";
	}
}

void _quit_signal(int)
{
    _quit.store(true);
}

void FaultEvent(void) {
	//printf("Fault \n");
}

int main(int argc, char *argv[]) {
	
	PiBotBoard board = PIBOT_4WD;
	PiBot pibot;
	Encoder enc1(20, 5), enc2(20, 16);
	MagAcc magacc;
	Barometer bar;
	char c[3];
	float lightLevel = 0;
	float targetSpeed = 3, speedWheelLeft, speedWheelRight;
	float turnSpeed = 0;
	int16_t driveWheelLeft = 60, driveWheelRight = 60; 
	int prevCnt[2];
    struct sigaction sa;
	RobotCommand command = NO_COMMAND;
	int lircFd = -1;
	
	if (argc > 1) {
		if (string(argv[1])=="pibot_2wd") {
			board = PIBOT_2WD;
		} else if (string(argv[1])=="pibot_zero") {
			board = PIBOT_ZERO;
		}
	}
		
    memset( &sa, 0, sizeof(sa) ); 
    sa.sa_handler = _quit_signal;
    sigfillset(&sa.sa_mask);
    sigaction(SIGINT,&sa,NULL); 
	
	lircFd = LircOpen((char*)"/dev/lircd");
	kb_nonblock(true);
	
	pinMode(24,  INPUT);
	pullUpDnControl(24, PUD_UP);
	wiringPiISR(24, INT_EDGE_FALLING, FaultEvent);
	
	pibot.InitMotorDriver(DRIVER_M_1_2);
	pibot.InitSonar(1);
	pibot.InitSonar(2);
	pibot.InitSonar(3);
	
	if (board == PIBOT_4WD) {
		pibot.SetCurrentDrive(14, 10);
		//pibot.SetCurrentLimit(10);
	} else if (board == PIBOT_2WD) {
		pibot.SetCurrentDrive(16, 10);
	} else {
		pinMode(17,  OUTPUT); // zero encoder current drive on/off
		digitalWrite(17, HIGH);
	}
	
	pibot.Enable();

	while (1) {
		std::system("clear");
		//k=kbhit();
        while (kbhit()!=0)
        {
			c[2] = c[1];
			c[1] = c[0];
            c[0]=fgetc(stdin);
			switch (c[0]) {
				case 'q': _quit.store(true); break;
				case '\033': break;
				case '[': break;
				case 'A':
					if (c[2] == '\033' && c[1] == '[') {
						// arrow up, speed up
						command = SPEED_UP_FORWARD;
					}
					break;
				case 'B':
					if (c[2] == '\033' && c[1] == '[') {
						// arrow down, slow down
						command = SPEED_UP_BACKWARD;
					}
					break;
				case 'C':
					if (c[2] == '\033' && c[1] == '[') {
						// arrow right
						command = TURN_RIGHT;
					}
					break;
				case 'D':
					if (c[2] == '\033' && c[1] == '[') {
						// arrow left
						command = TURN_LEFT;
					}
					break;
				case 'l': 
					if (lightLevel <= 0) lightLevel = 1.0/256;
					else if (lightLevel <= 0.5) lightLevel *= 2;
					break;
				case 'k':
					if (lightLevel>=1.0/128) lightLevel /= 2; 
					else lightLevel = 0;
					break;
				default:
					break;
			}	
        }

		string irKey = LircGetKey(lircFd);
		if (irKey != "") {
			if (irKey == "KEY_UP") {
				command = SPEED_UP_FORWARD;
			} else if (irKey == "KEY_DOWN") {
				command = SPEED_UP_BACKWARD;
			} else if (irKey == "KEY_LEFT") {
				command = TURN_LEFT;
			} else if (irKey == "KEY_RIGHT") {
				command = TURN_RIGHT;
			}
		}
		
		switch (command) {
			case SPEED_UP_FORWARD:
				if (driveWheelLeft < 0 && driveWheelRight < 0)
					targetSpeed = 0;
				else
					if ((speedWheelLeft-targetSpeed) > -1 && (speedWheelRight-targetSpeed) > -1) targetSpeed += 1;
				break;
			case SPEED_UP_BACKWARD:
				if (driveWheelLeft > 0 && driveWheelRight > 0)
					targetSpeed = 0;
				else
					if ((speedWheelLeft-targetSpeed) < 1 && (speedWheelRight-targetSpeed) < 1) targetSpeed -= 1;
				break;
			case TURN_LEFT: 
				turnSpeed = -4;
				break;
			case TURN_RIGHT:
				turnSpeed = 4;
				break;
			default:
				break;
		}
		command = NO_COMMAND;

		if (board == PIBOT_4WD) {
			pibot.SetLedDrive(13, 1-lightLevel);
		} else {
			pibot.SetLedDrive(20, 1-lightLevel);
		}
		
		pibot.SonarTrigger();
		
		speedWheelLeft =  enc1.AngularSpeed()*(driveWheelLeft<0?-1:1); 
		speedWheelRight = enc2.AngularSpeed()*(driveWheelRight<0?-1:1);
		// Regulate speed of wheels
		driveWheelLeft += ((targetSpeed+turnSpeed) - speedWheelLeft) * 10;
		if (driveWheelLeft > 255) driveWheelLeft = 255;
		if (driveWheelLeft < -255) driveWheelLeft = -255;
		driveWheelRight += ((targetSpeed-turnSpeed) - speedWheelRight) * 10;
		if (driveWheelRight > 255) driveWheelRight = 255;
		if (driveWheelRight < -255) driveWheelRight = -255;
		turnSpeed = 0;
		
		pibot.SetMotorDrive(M1, driveWheelLeft);
		pibot.SetMotorDrive(M2, driveWheelRight);
		
		cout <<"Input voltage: "<<pibot.adc.ConvertToVolts(AIN0, ADC_FS_4_096V)*4<<endl; 
		cout <<"Temperature: "<<pibot.GetTemperature(10000, 3435, 3.3)<<endl; 
		cout << "Light Level: "<<lightLevel<<endl;
		cout << "magX: " << magacc.GetMagX()<< " magY: " << magacc.GetMagY()<< " magZ: " << magacc.GetMagZ() << endl;
		cout << "accX: " << magacc.GetAccX()<< " accY: " << magacc.GetAccY()<< " accZ: " << magacc.GetAccZ() << endl;
		cout << "Barometer temp: " << bar.GetTemp() << " °C, pressure: " << bar.GetPressure()/100 << " [mb], humidity: " << bar.GetHumidity()<<" %"<< endl;
		cout << "range1 [cm]: " << pibot.SonarDistance(1) << "  range2 [cm]: " << pibot.SonarDistance(2) << "  range3 [cm]: " << pibot.SonarDistance(3) << endl;
		cout << "drive: "<< (int)driveWheelLeft <<", "<< (int)driveWheelRight<< " target: "<< targetSpeed << ", speed left "<< speedWheelLeft<< ", speed right "<< speedWheelRight << endl;
		if (pibot.IsPowerLow()) {
			cout << "Low power: " << endl;
			break;
		}
		if (pibot.IsFault()) {
			cout << "Fault" << endl;
		}
		usleep(50000);
		//pibot.Enable();
		
		if( _quit.load() ) break;    // exit normally after SIGINT
	}
	
	LircClose(lircFd);
	kb_nonblock(false);
	return 0;
}