from os import system

from flask import Flask
from flask import render_template
from flask import Response
from flask import request, url_for
from camera import VideoCamera


app = Flask(__name__)


@app.route('/', methods=['GET'])
def index2():
    if request.method == 'GET':

        #system("x-terminal-emulator")

        return render_template('index.html')

    return render_template('index.html')


def gen(camera):
    while True:
        frame = camera.get_frame()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(gen(VideoCamera()),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route('/move')
def move():
    arg = request.args.get("id")

    if arg == "up":
        print("up")

    if arg == "down":
        print("down")

    if arg == "left":
        print("left")

    if arg == "right":
        print("right")

    return ""
#
# def ff():
#     if request.method == ['POST']:
#
#         print("123")
#         system("x-terminal-emulator")
#         return render_template('index.html')
#     return render_template('base.html')


if __name__ == '__main__':
    app.run(host='10.13.37.105', debug=True)