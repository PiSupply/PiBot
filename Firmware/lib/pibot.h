/*****************************************************************
File: pibot.h
Version: 1.0

Author: Milan Neskovic 2016-2018, milan@pi-supply.com

Description:
	Declares C++ Classes for interfacing to PiBot Boards based 
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
#ifndef PIBOT_H
#define PIBOT_H

#include <stdint.h>
#include <sys/time.h>
#include <vector>
#include <functional>
#include <chrono>

#define PCA9634_ADDR 0x3C
#define PCA9685_ADDR 0x40
#define MAG_ADDR 0x1E
#define ACC_ADDR 0x1D
#define BAR_ADDR 0x76
#define ADC_ADDR 0x49

#define PIBOT_M1	0
#define PIBOT_M2	1
#define PIBOT_M3	2
#define PIBOT_M4	3

#define MAX_ENCODERS	8

namespace pibot {
	
enum DriverId { DRIVER_M_1_2=0, DRIVER_M_3_4 };
enum DriverOutput { M1=0, M2, M3, M4 };
enum DeacayMode {SLOW, FAST};
enum EncoderChannel { ENC1=0, ENC2 };
enum AdcInput {AIN_DIFF_01 = 0, AIN_DIFF_03, AIN_DIFF_13, AIN_DIFF_23, AIN0, AIN1, AIN2, AIN3};
enum AdcFullScale {ADC_FS_6_144V = 0, ADC_FS_4_096V, ADC_FS_2_048V, ADC_FS_1_024V, ADC_FS_0_512V, ADC_FS_0_256V};
class VectorXYZ {
public:
	float x;
	float y;
	float z;
};
	
class PCA9634
{
public:
	enum outputDriveT { OPEN_DRAIN=0, TOTEM_POLE=4 };
	enum outputStateT { OFF=0, ON=1, PWM, PWM_GROUP, UNKNOWN };
	PCA9634(int address = PCA9634_ADDR);
	~PCA9634();
	int Configure(bool inverted, outputDriveT outDrv, uint8_t outne);
	int SetState(uint8_t output, outputStateT state);
	outputStateT GetState(uint8_t output);
	int SetGroupStates(uint8_t groupId, outputStateT s0, outputStateT s1, outputStateT s2, outputStateT s3);
	int SetPulse(uint8_t output, uint8_t width);
private:
	int _fd;
	uint8_t _states[2];
	int16_t _pw[8];
};

class PCA9685
{
public:
	PCA9685(int address = PCA9685_ADDR);
	~PCA9685();
	int SetPulse(uint8_t channel, uint16_t timeOn, uint16_t timeOff);
private:
	int _fd;
	int16_t _tOn[16], _tOff[16];
};

class MotorDriver
{
public:
	MotorDriver(int id, PCA9634 &pwmDriver, bool paralellMode = false);
	~MotorDriver();
	int SetOutputLevel(uint8_t output, int16_t level);
	void PreEnable();
	void PostEnable();
private:
	int _id;
	PCA9634 &_pwmDriver;
	bool _parMode;
	PCA9634::outputStateT _inputStates[4];
	/*unsigned char _motorStateRegs[2];
	unsigned char _motorSpeedReg1[2];
	unsigned char _motorSpeedReg2[2];*/
};

class StepperDriver
{
public:
	StepperDriver(MotorDriver& driver);
	int32_t DriveSteps(int32_t steps, uint32_t periodUs, uint8_t driveLevel = 255);
	int32_t GetStep() {return _step;}
private:
	MotorDriver& _driver;
	int32_t _step;
	struct timeval _stepTime;
	struct timeval _refTime;
	uint32_t _prevPeriod;
	int32_t _nextTime;
};
	
class Encoder
{
public:
	friend class PiBot;
	Encoder(int16_t countsPerRevolution, int8_t pin);
	Encoder(int16_t countsPerRevolution, int8_t pinA, int8_t pinB);
	float AngularSpeed();
	float LinearSpeed(float radius_mm);
	const int cpr;
	const int pin_a;
    const int pin_b; 
	int32_t counter;
private:
	static void _UpdateCounterIsrCb(Encoder *encoder);
	static void _UpdateIsrCb(Encoder *encoder);
	volatile int _lastEncoded;
	std::chrono::time_point<std::chrono::high_resolution_clock> _tick;
	float _pulsePeriodNs;
};

class MagAcc
{
public:
	MagAcc();
	~MagAcc();
	int SetAccFs(unsigned char fs);
	int SetMagFs(unsigned char fs);
	VectorXYZ ReadAcceleration();
	float GetMagX();
	float GetMagY();
	float GetMagZ();
	float GetAccX();
	float GetAccY();
	float GetAccZ();
	float GetTemp();
private:
	int _magI2cFd;
	int _accI2cFd;
	unsigned char _accFs;
	static float _accFsSensMap[];
	unsigned char _magFs;
	static float _magFsSensMap[];
};

class Barometer
{
public:
	Barometer();
	~Barometer();
	float GetTemp();
	float GetPressure(); // Reads pressure in Pascals
	float GetHumidity();// Reads relative humidity
private:
	int _ReadData();
	int _i2cFd;
	int _data[8];
	float dig_T[3];
	float dig_P[10];
	float dig_H[6];
	float t_fine;
};

class ADConverter
{
public:
	ADConverter();
	~ADConverter();
	uint16_t GetRawConversion();
	float ConvertToVolts(AdcInput input, AdcFullScale fullScale);
private:
	int _i2cFd;
};

class SonarDriver
{
public:
	SonarDriver(uint8_t channel);
	//~SonarDriver();
	void Triggered();
	float GetDistance() {return dist;}
private:
	static void _EchoIsrCb(SonarDriver *driver);

	float dist;
	std::chrono::time_point<std::chrono::high_resolution_clock> _triggerTime;
};

class PiBot 
{
public:
	PiBot(bool watchdogMode = false);
	~PiBot();
	int InitMotorDriver(DriverId driverId, bool paralellMode = false);
	int SetMotorDrive(DriverOutput output, int16_t level, DeacayMode deacayMode = SLOW);
	int SetDriverLimit(DriverId driverId, float choppingCurrent); // Sets maximum driver chopping current
	int InitStepperDriver(DriverId driverId);
	StepperDriver& Stepper(DriverId driverId);
	int InitSonar(uint8_t channel);
	float SonarDistance(uint8_t channel);
	/*static*/ void Enable();
	static void Disable();
	bool IsPowerLow() {return _lowPowerEvent;}
	bool IsFault();
	//int32_t DriveSteps(uint8_t coil1, uint8_t coil2, int32_t steps, uint32_t periodUs, uint8_t torque = 255);
	//int32_t DriveHalfSteps(uint8_t coil1, uint8_t coil2, int32_t steps, uint32_t periodUs, uint8_t torque = 255);
	int SetPWM(uint8_t channel, float dutyCircle);
	int SetLedDrive(uint8_t channel, float level);
	int SetCurrentDrive(uint8_t channel, float current_mA);
	int SetServoControl(uint8_t channel, uint16_t pulseWidthUs);
	float GetTemperature(float r25, float beta, float refVoltage);
	//float GetRangeCm(int triggerPin, int echoPin, float velocity = 340.0);
	void SonarTrigger();
	ADConverter adc;
private:
	static void _LowPowerCb(void);
	static void _FaultCb(void);
	
	PCA9634 _pca9634;
	PCA9685 _pca9685;
	
	MotorDriver *_mDriver[2];
	StepperDriver *_stepDrv[2];
	SonarDriver *_sonars[5];
	static bool _lowPowerEvent;
	//static bool _faultEvent;
	static bool _wdMode;
};

}
#endif // PIBOT_H
