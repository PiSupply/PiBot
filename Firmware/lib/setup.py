#!/usr/bin/env python

from distutils.core import setup
from distutils.extension import Extension

setup(name="PiBot",
	version='1.0',
    description='PiBot Python Module',
	author='Milan Neskovic',
    author_email='milan@pi-supply.com',
    ext_modules=[
        Extension("pibot", ["python_pibot.cpp", "pibot.cpp"],
        libraries = ["boost_python", "wiringPi"],
		extra_compile_args=['-std=c++11'])
    ])
