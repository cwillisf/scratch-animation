(function() {
    var AnimationExtension = function () {
        this._bpm = 120;
        this._bones = {};

        var instance = this;
        AnimationExtension.kBodyParts.map(function (partName) {
            instance._bones[partName] = new Transform2D();
        });

        instance._bones['body'].setParent(null);
        instance._bones['head'].setParent(instance._bones['body']);
        instance._bones['left arm'].setParent(instance._bones['body']);
        instance._bones['right arm'].setParent(instance._bones['body']);
        instance._bones['left leg'].setParent(instance._bones['body']);
        instance._bones['right leg'].setParent(instance._bones['body']);

        this.startAnimation('idle');
    };

    AnimationExtension.kExtensionName = 'Skeletal Animation';
    AnimationExtension.kExtensionURL = 'http://cwillisf.github.io/scratch-animation/';
    AnimationExtension.kBodyParts = ['body', 'head', 'left arm', 'right arm', 'left leg', 'right leg'];
    AnimationExtension.kAttributes = ['direction', 'x position', 'y position'];

    AnimationExtension.kAnimations = {
        'wave hello': WaveHelloAnimation,
        'dance': DanceAnimation,
        'idle': IdleAnimation
    };

    AnimationExtension.kExtensionDescriptor = {
        blocks: [
            [' ', 'start animation %m.ext_animation_animationNames', 'startAnimation',
                Object.keys(AnimationExtension.kAnimations)[0]],
            [' ', 'set dance speed to %n beats per minute', 'setDanceBPM',
                120],
            [' ', 'set %m.ext_animation_bodyParts offset to %n,%n', 'setOffset',
                AnimationExtension.kBodyParts[0], 0, 0],
            ['r', 'get current animation name', 'getAnimationName'],
            ['r', 'get %m.ext_animation_bodyParts %m.ext_animation_attributes', 'getAttribute',
                AnimationExtension.kBodyParts[0], AnimationExtension.kAttributes[0]]
        ],
        menus: {
            ext_animation_animationNames: Object.keys(AnimationExtension.kAnimations),
            ext_animation_bodyParts: AnimationExtension.kBodyParts,
            ext_animation_attributes: AnimationExtension.kAttributes
        },
        url: AnimationExtension.kExtensionURL
    };

    AnimationExtension.prototype._getStatus = function() {
        return {
            status: 2,
            msg: 'Ready to animate'
        }
    };

    AnimationExtension.prototype._stop = function() {
        this.startAnimation('idle');
    };

    AnimationExtension.prototype._updateAnimation = function(time) {
        var elapsedTime = time - this._startTime;
        var animationFunction = AnimationExtension.kAnimations[this._currentAnimation] || IdleAnimation;
        animationFunction(elapsedTime, this._bpm, this._bones);
    };

    AnimationExtension.prototype.startAnimation = function(newName) {
        this._startTime = window.performance.now();
        this._currentAnimation = newName;
    };

    AnimationExtension.prototype.setDanceBPM = function(bpm) {
        this._bpm = bpm;
    };

    AnimationExtension.prototype.setOffset = function(bodyPart, offsetX, offsetY) {
        this._bones[bodyPart].setTranslation(offsetX, offsetY);
    };

    AnimationExtension.prototype.getAnimationName = function() {
        return this._currentAnimation;
    };

    AnimationExtension.prototype.getAttribute = function(bodyPart, attributeName) {
        // TODO: it's wasteful to update all bones each time any attribute of any bone is queried...
        // Maybe this should be exposed as a command block
        this._updateAnimation(window.performance.now());

        var transform = this._bones[bodyPart].getWorldTransform();
        var translation = transform.getTranslation();

        switch (attributeName) {
            case 'direction':
                return transform.getDirection();
            case 'x position':
                return translation[0];
            case 'y position':
                return translation[1];
        }
    };

    function IdleAnimation(elapsedTime, beatsPerMinute, bones) {
        bones['head'].setDirection(0);
        bones['body'].setDirection(0);
        bones['left arm'].setDirection(0);
        bones['right arm'].setDirection(0);
        bones['left leg'].setDirection(0);
        bones['right leg'].setDirection(0);
    }

    function WaveHelloAnimation(elapsedTime, beatsPerMinute, bones) {
        IdleAnimation(elapsedTime, beatsPerMinute, bones);
        bones['right arm'].setDirection(Math.cos(elapsedTime / 300) * 20 - 75);
        bones['left arm'].setDirection(-60);
    }

    function DanceAnimation(elapsedTime, beatsPerMinute, bones) {
        var beatsPerMillisecond = beatsPerMinute / 60 / 1000;

        // These go back and forth between -1 and 1
        var everyBeat = Math.abs((elapsedTime * beatsPerMillisecond * 2) % 4 - 2) - 1;
        var everyOtherBeat = Math.abs((elapsedTime * beatsPerMillisecond) % 4 - 2) - 1;

        bones['body'].setDirection(everyBeat * -5);
        bones['head'].setDirection(everyBeat * 15);
        bones['left arm'].setDirection(everyOtherBeat * 20 - 40);
        bones['right arm'].setDirection(everyOtherBeat * -20 + 40);
        bones['left leg'].setDirection(everyBeat * 20);
        bones['right leg'].setDirection(everyBeat * -20);
    }

    // This class represents an affine transformation in 2D
    // See https://en.wikipedia.org/wiki/Transformation_matrix#Affine_transformations
    // To make the math a little easier to understand, store the translation separately.
    var Transform2D = function () {
        this._rotationColumns = [
            [1, 0], // x axis
            [0, 1] // y axis
        ];
        this._translation = [0, 0];
        this._parent = null;
    };

    // Return a new Transform2D representing `lhs * rhs`.
    // This can be used to concatenate two transforms.
    Transform2D.multiply = function(lhs, rhs) {
        var result = new Transform2D();

        // See https://en.wikipedia.org/wiki/Matrix_multiplication#Square_matrices
        // If `.r[col,row]` is shorthand for `._rotationColumns[col][row]`
        // and `.t[row]` is shorthand for `._translation[row]`
        // then the operation we're doing here is:
        // | lhs.r[0,0] lhs.r[1,0] lhs.t[0] |   | rhs.r[0,0] rhs.r[1,0] rhs.t[0] |
        // | lhs.r[0,1] lhs.r[1,1] lhs.t[1] | * | rhs.r[0,1] rhs.r[1,1] rhs.t[1] |
        // |     0          0          1    |   |     0          0          1    |

        result._rotationColumns[0][0] =
            lhs._rotationColumns[0][0] * rhs._rotationColumns[0][0] +
            lhs._rotationColumns[1][0] * rhs._rotationColumns[0][1];
        result._rotationColumns[0][1] =
            lhs._rotationColumns[0][1] * rhs._rotationColumns[0][0] +
            lhs._rotationColumns[1][1] * rhs._rotationColumns[0][1];
        result._rotationColumns[1][0] =
            lhs._rotationColumns[0][0] * rhs._rotationColumns[1][0] +
            lhs._rotationColumns[1][0] * rhs._rotationColumns[1][1];
        result._rotationColumns[1][1] =
            lhs._rotationColumns[0][1] * rhs._rotationColumns[1][0] +
            lhs._rotationColumns[1][1] * rhs._rotationColumns[1][1];
        result._translation[0] =
            lhs._rotationColumns[0][0] * rhs._translation[0] +
            lhs._rotationColumns[1][0] * rhs._translation[1] +
            lhs._translation[0];
        result._translation[1] =
            lhs._rotationColumns[0][1] * rhs._translation[0] +
            lhs._rotationColumns[1][1] * rhs._translation[1] +
            lhs._translation[1];

        return result;
    };

    Transform2D.prototype.setParent = function(parentTransform) {
        this._parent = parentTransform;
    };

    Transform2D.prototype.getWorldTransform = function() {
        if (!this._parent) {
            return this;
        }
        var parentWorld = this._parent.getWorldTransform();
        return Transform2D.multiply(parentWorld, this);
    };

    Transform2D.prototype.setTranslation = function(x, y) {
        this._translation[0] = x;
        this._translation[1] = y;
    };

    Transform2D.prototype.getTranslation = function() {
        return [this._translation[0], this._translation[1]];
    };

    Transform2D.prototype.setDirection = function(degrees) {
        var radians = degrees * Math.PI / 180;
        var cosine = Math.cos(radians);
        var sine = Math.sin(radians);
        this._rotationColumns[0][0] = cosine;
        this._rotationColumns[0][1] = sine;
        this._rotationColumns[1][0] = -sine;
        this._rotationColumns[1][1] = cosine;
    };

    Transform2D.prototype.getDirection = function() {
        var radians = Math.atan2(this._rotationColumns[0][0], this._rotationColumns[0][1]);
        return radians * 180 / Math.PI;
    };

    var ext = new AnimationExtension();
    ScratchExtensions.register(AnimationExtension.kExtensionName, AnimationExtension.kExtensionDescriptor, ext);
})();
