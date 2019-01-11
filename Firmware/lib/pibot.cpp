/*****************************************************************
File: pibot.cpp
Version: 1.0

Author: Milan Neskovic 2016-2018, milan@pi-supply.com

Description:
	Implements C++ Classes for interfacing to PiBot Boards based 
	Robot.

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
#include <stdlib.h>
#include <unistd.h>
#include <stdint.h>
#include <stdio.h>
#include <fcntl.h>
#include <linux/i2c-dev.h>
//#include <linux/i2c.h>
#include <sys/ioctl.h>
#include <wiringPi.h>
#include <wiringPiI2C.h>
#include <iostream>
#include <math.h>
#include <sys/time.h> 

using namespace pibot;

#define GET_S16(dL, dH)	((int16_t)((((uint16_t)(dH))<<8)|(uint8_t)(dL)))

typedef void (*_PinCallbackT)();
void ObjWiringPiISR(int val, int mask, std::function<void()> callback);

std::function<void()> _objCbFunc[5];

void _PinCallback0() { _objCbFunc[0](); }
void _PinCallback1() { _objCbFunc[1](); }
void _PinCallback2() { _objCbFunc[2](); }
void _PinCallback3() { _objCbFunc[3](); }
void _PinCallback4() { _objCbFunc[4](); }

static _PinCallbackT _pinCbs[5] = {_PinCallback0, _PinCallback1, _PinCallback2, _PinCallback3, _PinCallback4};
static int _pinCbCount = 0;

void ObjWiringPiISR(int val, int mask, std::function<void()> callback)
{
  if (_pinCbCount > 4) return;
  _objCbFunc[_pinCbCount] = callback;
  wiringPiISR(val, mask, _pinCbs[_pinCbCount]);
  _pinCbCount ++;
}

uint16_t I2cRead16(int fd, int reg) {
	uint8_t buf[2];
	wiringPiI2CWrite(fd, reg); 
	usleep(100);
	read(fd, buf, 2);
	int res = buf[0];
	res <<= 8;
	res |= buf[1];
	return res;
}

int I2cWrite16(int fd, uint8_t reg, uint16_t value) {
	uint8_t buf[3] = {reg, (uint8_t)(value>>8), (uint8_t)value};
	return write(fd, buf, 3);
}

uint32_t I2cRead24(int fd, int reg) {
	uint8_t buf[3];
	wiringPiI2CWrite(fd, reg); 
	usleep(100);
	read(fd, buf, 3);
	uint32_t res = buf[0] << 8;
	res |= buf[1];
	res <<= 8;
	res |= buf[2];
	return res;
}

PCA9634::PCA9634(int address) {
	// Initialize
	_fd = wiringPiI2CSetup(address);
	wiringPiI2CWriteReg8(_fd, 0x00, 0x00);
	wiringPiI2CWriteReg8(_fd, 0x01, 0x02);
	_states[0] = wiringPiI2CReadReg8(_fd, 0x0c);
	_states[1] = wiringPiI2CReadReg8(_fd, 0x0d);
	for (int i = 0; i < 8; i++) _pw[8] = -1;
}

PCA9634::~PCA9634() {
	wiringPiI2CWriteReg8(_fd, 0x00, 0x10); // Low power mode
	close(_fd);
} 

int PCA9634::Configure(bool inverted, outputDriveT outDrv, uint8_t outne) {
	uint8_t cfg = (inverted?0x10:0x00) | (uint8_t)outDrv | outne;
	//std::cout << "cfg " << (int)cfg << std::endl;
	wiringPiI2CWriteReg8(_fd, 0x01, cfg);
}

int PCA9634::SetState(uint8_t output, outputStateT state) {
	uint8_t groupId = (output&0x04)>>2;
	uint8_t stateRegShift = (output&0x03) * 2;
	uint8_t newStates = _states[groupId];
	newStates &= ~(0x03 << stateRegShift);
	newStates |= (uint8_t)state << stateRegShift;
	if (newStates != _states[groupId]) {
		wiringPiI2CWriteReg8(_fd, 0x0c+groupId, newStates);
		_states[groupId] = newStates;
	}
}

PCA9634::outputStateT PCA9634::GetState(uint8_t output){
	uint8_t s = output&0x04 ? (uint8_t)_states[1] >> ((output&0x03) * 2) 
		: (uint8_t)_states[0] >> ((output&0x03) * 2);
	return (PCA9634::outputStateT)s;
}

int PCA9634::SetGroupStates(uint8_t groupId, outputStateT s0, outputStateT s1, outputStateT s2, outputStateT s3) {
	uint8_t newStates  = (uint8_t)s0 | ((uint8_t)s1 << 2) | ((uint8_t)s2 << 4) | ((uint8_t)s3 << 6);
	//std::cout << "new states " << (int)newStates << std::endl;
	if (newStates != _states[groupId]) {
		wiringPiI2CWriteReg8(_fd, 0x0c+(groupId&1), newStates );
		_states[groupId] = newStates;
	}
}

int PCA9634::SetPulse(uint8_t output, uint8_t width) {
	if (_pw[output] != width) {
		wiringPiI2CWriteReg8(_fd, 0x02 + output, width );
		_pw[output] = width;
	}
}

PCA9685::PCA9685(int address) {
	// Initialize PCA9685 I2C
	_fd = wiringPiI2CSetup(address);
	wiringPiI2CWriteReg8(_fd, 0x00, 0x10); // set sleep mode to change prescaler
	usleep(5000);
	//wiringPiI2CWriteReg8(_pca9685Fd, 0xFE, 0x03); // set prescale to 1526 Hz
	wiringPiI2CWriteReg8(_fd, 0xFE, 0x79); // set prescale to 50 Hz, 20mS required by servos
	wiringPiI2CWriteReg8(_fd, 0x00, 0x00);
	wiringPiI2CWriteReg8(_fd, 0x01, 0x06); // totem-pole, high impedance when disabled
	for (int i = 0; i < 16; i++) {
		_tOn[i] = -1; // unknown initial register state
		_tOff[i] = -1;
	}
}

PCA9685::~PCA9685() {
	wiringPiI2CWriteReg8(_fd, 0x00, 0x10); // set sleep mode
	close(_fd);
}

int PCA9685::SetPulse(uint8_t channel, uint16_t timeOn, uint16_t timeOff) {
	uint8_t reg = 0x06 + (channel&0x0F) * 4;
	if (_tOn[channel] != timeOn) {
		wiringPiI2CWriteReg8(_fd, reg, timeOn); //
		wiringPiI2CWriteReg8(_fd, reg + 1, timeOn >> 8);
		_tOn[channel] = timeOn;
	}
	if (_tOff[channel] != timeOff) {
		wiringPiI2CWriteReg8(_fd, reg + 2, timeOff); //
		wiringPiI2CWriteReg8(_fd, reg + 3, timeOff >> 8);
		_tOff[channel] = timeOff;
	}
	return 0;
}

MotorDriver::MotorDriver(int id, PCA9634 &pwmDriver, bool paralellMode):
	_pwmDriver(pwmDriver)
{
	_id = id;
	_parMode = paralellMode;
	if (_parMode) {
		_inputStates[0] = _inputStates[1] = PCA9634::OFF; // high impedance for ain1, ain2
		_inputStates[2] = _inputStates[3] = PCA9634::ON; // low state for bin1, bin2
	} else {
		_inputStates[0] = _inputStates[1] = _inputStates[2] = _inputStates[3] = PCA9634::ON;
	}
	_pwmDriver.SetGroupStates(_id, _inputStates[0], _inputStates[1], _inputStates[2], _inputStates[3]);
}

MotorDriver::~MotorDriver(){
}

void MotorDriver::PreEnable() {
	_pwmDriver.Configure(false, PCA9634::OPEN_DRAIN, 0x20);
	if (_parMode) {
		// high impedance for ain1, ain2, low state for bin1, bin2
		_pwmDriver.SetGroupStates(_id, PCA9634::OFF, PCA9634::OFF, PCA9634::ON, PCA9634::ON);
	} else {
		_pwmDriver.SetGroupStates(_id, PCA9634::ON, PCA9634::ON, PCA9634::ON, PCA9634::ON);
	}
	//usleep(10);
}

void MotorDriver::PostEnable() {
	//usleep(2500);
	_pwmDriver.Configure(false, PCA9634::TOTEM_POLE, 0x00);
	usleep(10000);
	_pwmDriver.SetGroupStates(_id, _inputStates[0], _inputStates[1], _inputStates[2], _inputStates[3]);
}

int MotorDriver::SetOutputLevel(uint8_t output, int16_t level) {
	int16_t pw;
	uint8_t out = (uint8_t)output;
	if (level >= 0) { // forward
		// first drive line pwm, second high state
		_inputStates[out*2] = PCA9634::OFF;
		_inputStates[out*2+1] = PCA9634::PWM;
		pw = level;
		_pwmDriver.SetPulse(_id*4+out*2+1, pw);
		 
	} else {
		// first drive high state, second pwm
		_inputStates[out*2] = PCA9634::PWM;
		_inputStates[out*2+1] = PCA9634::OFF;
		pw = -level;
		
		_pwmDriver.SetPulse(_id*4+out*2, pw);
	}
	if (_parMode) {
		_inputStates[0] = _inputStates[1] = PCA9634::ON; 
	}
	_pwmDriver.SetGroupStates(_id, _inputStates[0], _inputStates[1], _inputStates[2], _inputStates[3]);
	return 0;
}

StepperDriver::StepperDriver(MotorDriver& driver):
	_driver(driver)/*,
	_out1(output1),
	_out2(output2)*/
{
}

int32_t StepperDriver::DriveSteps(int32_t steps, uint32_t periodUs, uint8_t driveLevel) {
	int32_t absSteps = steps > 0 ? steps : -steps;
	struct timeval tv;
	
	for (int32_t i = 0; i < absSteps; i++) {
		gettimeofday(&tv, 0);
		uint32_t passedTime = (tv.tv_sec-_stepTime.tv_sec)*1000000 + tv.tv_usec-_stepTime.tv_usec;
		_stepTime = tv;
		if (i==0 && (_prevPeriod != periodUs || passedTime > periodUs*2) ) {
			_refTime = tv;
			_nextTime = periodUs;
		} else {
			int32_t drive_time = (_stepTime.tv_sec-_refTime.tv_sec)*1000000 + _stepTime.tv_usec-_refTime.tv_usec;
			_nextTime += periodUs;
			if (drive_time < _nextTime) usleep(_nextTime - drive_time);
		}
		
		if (steps > 0) {
			_driver.SetOutputLevel(0, _step&0x02 ? driveLevel : - driveLevel);
			_driver.SetOutputLevel(1, (_step+1)&0x02 ? driveLevel : - driveLevel);
			_step++;
		} else {
			_driver.SetOutputLevel(0, (_step-1)&0x02 ? driveLevel : - driveLevel);
			_driver.SetOutputLevel(1, _step&0x02 ? driveLevel : - driveLevel);
			_step--;
		}
	}
	_prevPeriod = periodUs;
	return _step;
	/*for (int i = 1; i <= steps; i++) {
		SetSpeed(coil1, 0, 255);
		SetSpeed(coil2, 1, 255);
		usleep(periodUs);
		SetSpeed(coil1, dir, 255);
		SetSpeed(coil2, dir, 255);
		usleep(periodUs);
		SetSpeed(coil1, 1, 255);
		SetSpeed(coil2, 0, 255);
		usleep(periodUs);
		SetSpeed(coil1, !dir, 255);
		SetSpeed(coil2, !dir, 255);
		usleep(periodUs);
	}*/
}

//std::vector<Encoder> encoders;

/*void PiBot::UpdateEncoders()
{
    //for (uint8_t i = 0; i < encoders.size(); i++) encoders[i].Update();
}*/

Encoder::Encoder(int16_t countsPerRevolution, int8_t pinA, int8_t pinB):
	cpr(countsPerRevolution),
	pin_a(pinA),
	pin_b(pinB),
	counter(0),
	_lastEncoded(0)
{
	if (pinA < 0 || pinB < 0) return;
    pinMode(pin_a, INPUT); 
	pullUpDnControl(pin_a, PUD_UP);
	pinMode(pin_b, INPUT);
	pullUpDnControl(pin_b, PUD_UP);
	ObjWiringPiISR(pin_a, INT_EDGE_BOTH, std::bind(&Encoder::_UpdateIsrCb, this));
	ObjWiringPiISR(pin_b, INT_EDGE_BOTH, std::bind(&Encoder::_UpdateIsrCb, this));
}

Encoder::Encoder(int16_t countsPerRevolution, int8_t pin):
	cpr(countsPerRevolution),
	pin_a(pin),
	pin_b(-1),
	counter(0),
	_lastEncoded(0)
{
	if (pin < 0) return; 
    pinMode(pin_a, INPUT); 
	pullUpDnControl(pin_a, PUD_UP);
	ObjWiringPiISR(pin_a, INT_EDGE_FALLING, std::bind(&Encoder::_UpdateCounterIsrCb, this));
}

void Encoder::_UpdateCounterIsrCb(Encoder *encoder) {
	std::chrono::time_point<std::chrono::high_resolution_clock> tickNow = std::chrono::high_resolution_clock::now();
	encoder->_pulsePeriodNs = (tickNow - encoder->_tick).count();
	encoder->_tick = tickNow; 
	encoder->counter++;
	//std::cout<<"encoder triggered "<<(int)encoder<<", "<<encoder->counter<<std::endl;
}

void Encoder::_UpdateIsrCb(Encoder *encoder) {
	int MSB = digitalRead(encoder->pin_a);
	int LSB = digitalRead(encoder->pin_b);

	int encoded = (MSB << 1) | LSB;
	int sum = (encoder->_lastEncoded << 2) | encoded;

	if(sum == 0b1101 || sum == 0b0100 || sum == 0b0010 || sum == 0b1011) encoder->counter++;
	if(sum == 0b1110 || sum == 0b0111 || sum == 0b0001 || sum == 0b1000) encoder->counter--;

	encoder->_lastEncoded = encoded;
}

float Encoder::AngularSpeed() {
	std::chrono::time_point<std::chrono::high_resolution_clock> tickNow = std::chrono::high_resolution_clock::now();
	float timePassed = (tickNow - _tick).count();
	if (timePassed < _pulsePeriodNs)
		return 1000000000.0 / (cpr * _pulsePeriodNs) * 2 * 3.14159;
	else
		return 1000000000.0 / (cpr * timePassed) * 2 * 3.14159;
}

float Encoder::LinearSpeed(float radius_mm) {
	return radius_mm * AngularSpeed() / 1000;
}

MagAcc::MagAcc() {
	_magI2cFd = wiringPiI2CSetup(MAG_ADDR);
	_accI2cFd = wiringPiI2CSetup(ACC_ADDR);
	// Setup control registers for reading
	wiringPiI2CWriteReg8(_accI2cFd, 0x24, 0x40); // reset
	usleep(200000);
	wiringPiI2CWriteReg8(_accI2cFd, 0x20, 0b00101111); // CTRL_1, enable x y z axis data, 50 hz sampling
	wiringPiI2CWriteReg8(_accI2cFd, 0x22, 0/*0b11000010*/); // CTRL_3,  
	wiringPiI2CWriteReg8(_accI2cFd, 0x23, 0x00); // CTRL_4, set +/- 2g full scale
	wiringPiI2CWriteReg8(_accI2cFd, 0x24, 0x02); // CTRL_5,  open drain active low interrupt signal
	wiringPiI2CWriteReg8(_accI2cFd, 0x26, 0x00<<2); // CTRL_7, latched interrupt
	//wiringPiI2CWriteReg8(_accI2cFd, 0x2E, (0x02<<5) | 25); // FIFO_CTRL, Stream mode, 25 treshold
	//wiringPiI2CWriteReg8(_accI2cFd, 0x30, 0x3F);

	wiringPiI2CWriteReg8(_magI2cFd, 0x21, 0b01100011); // CTRL_2, set +/- 16 gauss full scale, reboot memory, reset mag registers
	wiringPiI2CWriteReg8(_magI2cFd, 0x20, 0b01011000); // CTRL_2, High-performance mode, 40Hz,
	wiringPiI2CWriteReg8(_magI2cFd, 0x22, 0x00); // CTRL_3, Continuous-conversion mode
	wiringPiI2CWriteReg8(_magI2cFd, 0x23, 0x08); // CTRL_4, get magnetometer out of low power mode
	wiringPiI2CWriteReg8(_magI2cFd, 0x30, 0/*0xE9*/);
	
	_accFs = 0;
	_magFs = 1;
}

MagAcc::~MagAcc() {
	close(_accI2cFd);
	close(_magI2cFd);
}

float MagAcc::_accFsSensMap[] = {0.061, 0.122, 0.183, 0.244, 0.732};

int MagAcc::SetAccFs(unsigned char fs) {
	_accFs = fs<=4?fs:4;
	return wiringPiI2CWriteReg8(_accI2cFd, 0x23, _accFs << 3);
}

float MagAcc::_magFsSensMap[] = {0.080, 0.160, 0.320, 0.479};

int MagAcc::SetMagFs(unsigned char fs) {
	_magFs = fs&0x03;
	return wiringPiI2CWriteReg8(_magI2cFd, 0x21, _magFs << 5);
}
/*
int GetTwosComp(uint8_t msb, uint8_t lsb) {
    int32_t twosComp = msb;
	twosComp <<= 8;
	twosComp += lsb;
    if (twosComp >= 32768)
        return twosComp - 65536;
    else
        return twosComp;
}*/

VectorXYZ MagAcc::ReadAcceleration() {
	uint8_t buf[6];
	wiringPiI2CWrite(_accI2cFd, 0x28); 
	usleep(100);
	int n = read(_accI2cFd, buf, 6);
	//int n = i2c_smbus_read_i2c_block_data(_accI2cFd, 0x28, 6, &(buf[0]));
	//std::cout<<"n: "<<n<<"  "<<(int)buf[1]<<std::endl;
	VectorXYZ vec;
	//buf[4] = i2c_smbus_read_byte_data(_accI2cFd, 0x2c);
	//buf[5] = i2c_smbus_read_byte_data(_accI2cFd, 0x2d);
	vec.x = (float)GET_S16(buf[0], buf[1]) * _accFsSensMap[_accFs] / 1000;
	vec.y = (float)GET_S16(buf[2], buf[3]) * _accFsSensMap[_accFs] / 1000;
	vec.z = (float)GET_S16(buf[4], buf[5]) * _accFsSensMap[_accFs] / 1000;
	return vec;
}

float MagAcc::GetMagX(){
	int mag = GET_S16(	wiringPiI2CReadReg8(_magI2cFd, 0x28), // lsb byte
							wiringPiI2CReadReg8(_magI2cFd, 0x29) ); // msb byte
	return mag * _magFsSensMap[_magFs] / 1000; // convert to gauss
}

float MagAcc::GetMagY(){
	int mag = GET_S16(	wiringPiI2CReadReg8(_magI2cFd, 0x2a), // lsb byte
							wiringPiI2CReadReg8(_magI2cFd, 0x2b) ); // msb byte
	return mag * _magFsSensMap[_magFs] / 1000; // convert to gauss
}

float MagAcc::GetMagZ(){
	int mag = GET_S16(	wiringPiI2CReadReg8(_magI2cFd, 0x2c), // lsb byte
							wiringPiI2CReadReg8(_magI2cFd, 0x2d) ); // msb byte
	return mag * _magFsSensMap[_magFs] / 1000; // convert to gauss
}

float MagAcc::GetAccX() {
	int acc = GET_S16(	wiringPiI2CReadReg8(_accI2cFd, 0x28), // lsb byte
							wiringPiI2CReadReg8(_accI2cFd, 0x29) ); // msb byte
	return acc * _accFsSensMap[_accFs] / 1000; // convert to g units
}

float MagAcc::GetAccY() {
	int acc = GET_S16(	wiringPiI2CReadReg8(_accI2cFd, 0x2a), // lsb byte
							wiringPiI2CReadReg8(_accI2cFd, 0x2b) ); // lsb msb
	return acc * _accFsSensMap[_accFs] / 1000;
}

float MagAcc::GetAccZ() {
	int acc = GET_S16(	wiringPiI2CReadReg8(_accI2cFd, 0x2c), // lsb byte
							wiringPiI2CReadReg8(_accI2cFd, 0x2d) ); // msb byte
	return acc * _accFsSensMap[_accFs] / 1000;
}

float MagAcc::GetTemp() {
	return (float)GET_S16(	wiringPiI2CReadReg8(_magI2cFd, 0x2E),
						wiringPiI2CReadReg8(_magI2cFd, 0x2F) ) / 8;
}

Barometer::Barometer() {
	_i2cFd = wiringPiI2CSetup(BAR_ADDR);
	wiringPiI2CWriteReg8(_i2cFd, 0xE0, 0xB6);
	usleep(200000);
	dig_T[0] = (uint16_t)wiringPiI2CReadReg16(_i2cFd, 0x88);
	for (int i = 1; i < 3; i++) 
		dig_T[i] = (int16_t)wiringPiI2CReadReg16(_i2cFd, 0x88 + i*2);
	dig_P[0] = (uint16_t)wiringPiI2CReadReg16(_i2cFd, 0x8E);
	for (int i = 1; i < 9; i++) 
		dig_P[i] = (int16_t)wiringPiI2CReadReg16(_i2cFd, 0x8E + i*2);
	dig_H[0] = (uint8_t)wiringPiI2CReadReg8(_i2cFd, 0xA1);
	dig_H[1] = (int16_t)wiringPiI2CReadReg16(_i2cFd, 0xE1);
	dig_H[2] = (uint8_t)wiringPiI2CReadReg8(_i2cFd, 0xE3);
	int16_t e4 = (int8_t)wiringPiI2CReadReg8(_i2cFd, 0xE4);
	uint8_t e5 = (uint8_t)wiringPiI2CReadReg8(_i2cFd, 0xE5);
	dig_H[3] = (int16_t)((e4<<4) | (e5 & 0x0F));
	int16_t e6 = (int8_t)wiringPiI2CReadReg8(_i2cFd, 0xE6);
	dig_H[4] = (e6<<4) | (e5 >> 4);
	dig_H[5] = (int8_t)wiringPiI2CReadReg8(_i2cFd, 0xE7);
	//for (int i = 0; i < 6; i++) std::cout<<"dig_H["+std::to_string(i)+"]: "<<(int)dig_H[i]<<std::endl;
	wiringPiI2CWriteReg8(_i2cFd, 0xF4, 0x24); // sleep mode
	wiringPiI2CWriteReg8(_i2cFd, 0xF5, (3 << 5) | (0 << 2));
	wiringPiI2CWriteReg8(_i2cFd, 0xF2, 1);
	wiringPiI2CWriteReg8(_i2cFd, 0xF4, (1 << 5) | (1 << 2) | 3);
	
	//std::cout << std::dec << "dig_T[0]: " << dig_T[0] << "  dig_T[1]: " << dig_T[1] << std::endl; 
}

Barometer::~Barometer() {
	close(_i2cFd);
}

int Barometer::_ReadData() {
	wiringPiI2CWrite(_i2cFd, 0xF7); 
	//usleep(100);
	return read(_i2cFd, _data, 8);
}

float Barometer::GetTemp(){
	float UT = I2cRead24(_i2cFd, 0xFA) >> 4;
	float var1 = (UT / 16384.0 - float(dig_T[0]) / 1024.0) * float(dig_T[1]);
	float var2 = ((UT / 131072.0 - float(dig_T[0]) / 8192.0) * 
		(UT / 131072.0 - float(dig_T[0]) / 8192.0)) * float(dig_T[2]);
	t_fine = int(var1 + var2);
	float temperature = (var1 + var2) / 5120.0;
	return temperature;
}

float Barometer::GetPressure(){
	float adc = I2cRead24(_i2cFd, 0xF7) >> 4;
	float var1 = t_fine / 2.0 - 64000.0;
	float var2 = var1 * var1 * dig_P[5] / 32768.0;
	var2 = var2 + var1 * dig_P[4] * 2.0;
	var2 = var2 / 4.0 + dig_P[3] * 65536.0;
	var1 = (dig_P[2] * var1 * var1 / 524288.0 + dig_P[1] * var1) / 524288.0;
	var1 = (1.0 + var1 / 32768.0) * dig_P[0];
	if (var1 == 0) return 0;
	float p = 1048576.0 - adc;
	p = ((p - var2 / 4096.0) * 6250.0) / var1;
	var1 = dig_P[8] * p * p / 2147483648.0;
	var2 = p * dig_P[7] / 32768.0;
	p = p + (var1 + var2 + dig_P[6]) / 16.0;
	return p; // pascals
}

float Barometer::GetHumidity() {
	/*_ReadData();
	uint16_t adc = _data[6];
	adc <<= 8;
	adc |= _data[7];*/
	float adc = I2cRead16(_i2cFd, 0xFD);
	float h = t_fine - 76800.0;
	h = (adc - (dig_H[3] * 64.0 + dig_H[4] / 16384.0 * h)) *
		(dig_H[1] / 65536.0 * (1.0 + dig_H[5] / 67108864.0 * h *
		(1.0 + dig_H[2] / 67108864.0 * h)));
	h = h * (1.0 - dig_H[0] * h / 524288.0);
	if (h > 100)
		h = 100;
	else if (h < 0)
		h = 0;
	return h;
}

ADConverter::ADConverter() {
	_i2cFd = wiringPiI2CSetup(ADC_ADDR);
	
	I2cWrite16(_i2cFd, 0x01, 0x6200);
	I2cWrite16(_i2cFd, 0x02, 1000); // lo tresh
	I2cWrite16(_i2cFd, 0x03, 1500); // hi tresh
}

ADConverter::~ADConverter() {
	close(_i2cFd);
}

uint16_t ADConverter::GetRawConversion() {
	return I2cRead16(_i2cFd, 0x00);
}

float ADConverter::ConvertToVolts(AdcInput input, AdcFullScale fullScale) {
	uint16_t config = 0x8180;//0x8183; // 1600 SPS, start single conversion, disable comparator
	config |= ((uint16_t)fullScale << 9);
	config |= ((uint16_t)input << 12);
	I2cWrite16(_i2cFd, 0x01, config);
	usleep(2000);
	int16_t val = I2cRead16(_i2cFd, 0x00);
	if (fullScale == ADC_FS_6_144V)
		return (float)(val>>4)*3/1000;
	else
		return (float)(val>>(2+(uint8_t)fullScale))/1000;
}

SonarDriver::SonarDriver(uint8_t channel) {
	static int8_t echoPin[] = {4, 27, 25, 12, 17};
	int pin = echoPin[channel-1];
	pinMode(pin, INPUT);
	pullUpDnControl(pin, PUD_UP);
	ObjWiringPiISR(pin, INT_EDGE_RISING, std::bind(&SonarDriver::_EchoIsrCb, this));
}

void SonarDriver::Triggered() {
	_triggerTime = std::chrono::high_resolution_clock::now();
}
/*
SonarDriver::_EvalEcho(uint8_t id) {
	std::chrono::time_point<std::chrono::high_resolution_clock> tickNow = std::chrono::high_resolution_clock::now();
	double echoPeriodNs = (tickNow - sonar->_triggerTime[id]).count();
	sonar->dist[id] = echoPeriodNs * 340 / 1000000000 / 2 * 100;
	//bot->_triggerTime1 = tickNow;
	std::cout<<"echotime1 "<< echoPeriodNs << std::endl;
}*/

void SonarDriver::_EchoIsrCb(SonarDriver *sonar) {
	std::chrono::time_point<std::chrono::high_resolution_clock> tickNow = std::chrono::high_resolution_clock::now();
	double echoPeriodNs = (tickNow - sonar->_triggerTime).count();
	sonar->dist = echoPeriodNs * 340 / 1000000000 / 2 * 100;
	//bot->_triggerTime1 = tickNow;
	//std::cout<<"echotime1 "<< echoPeriodNs << std::endl;
}

PiBot::PiBot(bool watchdogMode)
{
	_wdMode = watchdogMode;
	_lowPowerEvent = false;
	//_faultEvent = false;
	
	wiringPiSetupGpio(); // Initialize wiringPi
	pinMode(22,  OUTPUT); // deactivate enable
	digitalWrite(22, LOW);
	usleep(100);
	pinMode(22,  INPUT);
	pullUpDnControl(22, PUD_DOWN);
	wiringPiISR(22, INT_EDGE_FALLING, _LowPowerCb);
	
	pinMode(13,  INPUT);
	pullUpDnControl(13, PUD_UP);
	//wiringPiISR(13, INT_EDGE_FALLING, _FaultCb);	
	
	pinMode(26,  OUTPUT); // Sonars trigger
	
	_mDriver[0] = _mDriver[1] = NULL;
	_stepDrv[0] = _stepDrv[1] = NULL;
	
	for (int i = 0; i < 5; i++ ) 
		_sonars[i] = NULL;

}

PiBot::~PiBot(){
	Disable();
	delete _stepDrv[0];
	delete _stepDrv[1];
	delete _mDriver[0];
	delete _mDriver[1];
	for (int i = 0; i < 5; i++ )
		delete _sonars[i];
	
}

bool PiBot::_lowPowerEvent = false;
//bool PiBot::_faultEvent = false;
bool PiBot::_wdMode;

void PiBot::_LowPowerCb(void) {
	Disable();
	_lowPowerEvent = true;
	//printf("Low power \n");
	//PiBot::PowerControl(1);
}

/*void PiBot::_FaultCb(void) {
	Disable();
	_faultEvent = true;
}*/

bool PiBot::IsFault() {
	return (digitalRead(13)==0);
}

void PiBot::Enable() {
	int inState = digitalRead(22);
	if (inState==1) {
		if (!_wdMode) {
			pinMode(22,  INPUT);
			pullUpDnControl(22, PUD_UP);
			_lowPowerEvent = false;
			return;
		}
	} else {
		if (_mDriver[0] != NULL) _mDriver[0]->PreEnable();
		if (_mDriver[1] != NULL) _mDriver[1]->PreEnable();
	}
	// charge cap
	pinMode(22,  OUTPUT); 
	digitalWrite(22, HIGH);
	if (inState==0) 
		usleep(100);
	else
		usleep(5);
	// set to power monitor mode
	pinMode(22,  INPUT);
	if (_wdMode) {
		pullUpDnControl(22, PUD_OFF);
	} else {
		pullUpDnControl(22, PUD_UP);
	}
	if (digitalRead(22)==0) { 
		// unsuccessful try
		digitalWrite(22, LOW);
		pinMode(22,  OUTPUT);
		_lowPowerEvent = true;
	} else {
		_lowPowerEvent = false;
		if (inState==0 && ((_mDriver[0] != NULL) || (_mDriver[1] != NULL))) 
			// Necessary delay to precharge power caps for entering parallel mode
			usleep(10000);
		if (inState==0 && _mDriver[0] != NULL) {
			_mDriver[0]->PostEnable();
		}
		if (inState==0 && _mDriver[1] != NULL) {
			_mDriver[1]->PostEnable();
		}
	}
}

void PiBot::Disable() {
	digitalWrite(22, LOW);
	pinMode(22,  OUTPUT); 
}

int PiBot::InitMotorDriver(DriverId driverId, bool paralellMode) {
	if (_mDriver[(uint8_t)driverId] != NULL) 
		delete _mDriver[(uint8_t)driverId];
	_mDriver[(uint8_t)driverId] = new MotorDriver(driverId, _pca9634, paralellMode);
	return 0;
}

int PiBot::InitStepperDriver(DriverId driverId) {
	if (_stepDrv[(uint8_t)driverId])
		delete _stepDrv[(uint8_t)driverId];
	InitMotorDriver(driverId, false);
	_stepDrv[(uint8_t)driverId] = new StepperDriver(*(_mDriver[(uint8_t)driverId]));
	return 0;
}

StepperDriver& PiBot::Stepper(DriverId driverId) {
	return *_stepDrv[(uint8_t)driverId];
}

int PiBot::InitSonar(uint8_t channel) {
	if (_sonars[channel-1] != NULL)
		delete _sonars[channel-1];
	_sonars[channel-1] = new SonarDriver(channel);
}

float PiBot::SonarDistance(uint8_t channel) {
	return _sonars[channel-1]->GetDistance();
}

void PiBot::SonarTrigger() {
	digitalWrite(26, HIGH);
	usleep(15);                
	digitalWrite(26, LOW); 
	for (int i = 0; i < 5; i++ )
		if (_sonars[i]) _sonars[i]->Triggered();
}

int PiBot::SetPWM(uint8_t channel, float dutyCircle) {
	if (channel <= 16) {
		int16_t pw = dutyCircle*4096;
		if (pw >= 4096) {
			_pca9685.SetPulse(channel-1, 0xFFFF, 1);
		} else if (pw <= 0) {
			_pca9685.SetPulse(channel-1, 1, 0xFFFF);
		} else {
			_pca9685.SetPulse(channel-1, 0, dutyCircle*4096);
		}
			
	} else if (channel <= 20) {
		int16_t pw = 256-dutyCircle*256;
		if (pw >= 256) {
			_pca9634.SetState(channel-17+4, PCA9634::ON);
		} else { 
			_pca9634.SetPulse(channel-17+4, pw);
			_pca9634.SetState(channel-17+4, PCA9634::PWM);
		}
	}
	return 0;
}

int PiBot::SetLedDrive(uint8_t channel, float level) {
	SetPWM(channel, 1-level);
}

int PiBot::SetMotorDrive(DriverOutput output, int16_t level, DeacayMode deacayMode){
	return _mDriver[(uint8_t)output/2]->SetOutputLevel((uint8_t)output%2, level);
}

int PiBot::SetCurrentDrive(uint8_t channel, float current_mA) {
	if (channel <= 16)
		SetPWM(channel, current_mA * 47 / 5000);
		//_pca9685.SetPulse(channel-1, 0, current_mA * 4096 * 47 / 5000);
}

// Vref = Vd + r2 * (Vpwm - Vd) / (r1+r2) 
// Vref = 3.3 + 62000 * (dc*5 - 3.3) / 66700 = 4.648 * dc + 0.233
// dc = (Vref - 0.233) / 4.648 
int PiBot::SetDriverLimit(DriverId driverId, float choppingCurrent) {
	float vref = choppingCurrent * 6.6 * 0.22;
	vref = (vref > 3.3) ? 3.3 : vref;
	//_pca9685.SetPulse(14+(uint8_t)driverId, 0, ((vref-0.233)/4.648)*4096);
	SetPWM(15+(uint8_t)driverId, (vref-0.233)/4.648);
	return 0;
}

int PiBot::SetServoControl(uint8_t channel, uint16_t pulseWidthUs) {
	if (channel <= 16) {
		//_pca9685.SetPulse(channel-1, 0, pulseWidthUs*4096/20000);
		SetPWM(channel, (float)pulseWidthUs/20000);
	}
}

float PiBot::GetTemperature(float r25, float beta, float refVoltage) {
	float vr = adc.ConvertToVolts(AIN1, ADC_FS_4_096V);
	float r = (refVoltage - vr) / vr * 23700;
	return 1.0 / (log((double)r/r25)/beta + (double)1.0/298.15) - 273.15;
	//return (double)beta / log((double)r/(r25*exp(-(double)beta/298.15))) - 273.15;
}

/*float PiBot::GetRangeCm(int triggerPin, int echoPin, float velocity) {
	pinMode(echoPin,  INPUT);
	pullUpDnControl(echoPin, PUD_UP);
	pinMode(triggerPin,  OUTPUT);
	digitalWrite(triggerPin, HIGH);   // trigger
	
	usleep(30);
	digitalWrite(triggerPin, LOW);
	
	struct timeval cur_time1, cur_time2;
	int cnt = 0;
	while( (digitalRead(echoPin)==1) && cnt++ < 100 ) usleep(10);
	gettimeofday(&cur_time1,NULL);
	cnt = 0;
	while( (digitalRead(echoPin)==0) && cnt++ < 35000 ) usleep(10);
	gettimeofday(&cur_time2,NULL);
	
	return ( (double)(cur_time2.tv_usec - cur_time1.tv_usec) / 1000000 + cur_time2.tv_sec - cur_time1.tv_sec ) * velocity / 2 * 100;
}*/
