import {describe, expect, test} from 'vitest';
import {
    axisRotationMatrix,
    composePoseGesture,
    mat3Multiply,
    panoPoseMatrix,
    poseFromMatrix,
    poseTransform,
} from '../src/gesture.js';
import {normalizeYaw} from '../src/edit.js';

const close = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(eps);

const azDir = (azDeg, elDeg = 0) => {
    const a = (azDeg * Math.PI) / 180, e = (elDeg * Math.PI) / 180;
    return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
};

describe('panoPoseMatrix', () => {
    test('yaw-only reproduces theta − panoYaw', () => {
        for (const yaw of [0, 37, 180, 271]) {
            const m = panoPoseMatrix(yaw, 0, 0);
            for (const az of [0, 45, 200, 300]) {
                const nc = poseTransform(m, azDir(az));
                const theta = Math.atan2(nc[0], nc[1]);
                const expected = Math.atan2(Math.sin(((az - yaw) * Math.PI) / 180), Math.cos(((az - yaw) * Math.PI) / 180));
                close(theta, expected);
            }
        }
    });

    test('the capture forward direction maps to the image centre', () => {
        const m = panoPoseMatrix(40, 25, 0);
        const nc = poseTransform(m, azDir(40, 25));
        close(Math.atan2(nc[0], nc[1]), 0);
        close(Math.asin(nc[2]), 0);
    });

    test('stays orthonormal for any pose', () => {
        const m = panoPoseMatrix(123, -37, 21);
        const r = [m[0], m[3], m[6]], f = [m[1], m[4], m[7]], u = [m[2], m[5], m[8]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        for (const v of [r, f, u]) close(dot(v, v), 1);
        close(dot(r, f), 0);
        close(dot(f, u), 0);
        close(dot(u, r), 0);
    });

    test('valid at pitch ±90 (no degenerate cross product)', () => {
        const nc = poseTransform(panoPoseMatrix(0, 90, 0), [0, 0, 1]);
        close(nc[1], 1);
    });
});

describe('poseFromMatrix', () => {
    test('exact roundtrip of panoPoseMatrix', () => {
        for (const [y, p, r] of [[0, 0, 0], [37, 12, -8], [208, -25, 14], [359, 44, -44], [90, 89, 30]]) {
            const back = poseFromMatrix(panoPoseMatrix(y, p, r));
            close(back.yaw, normalizeYaw(y));
            close(back.pitch, p);
            close(back.roll, r);
        }
    });

    test('gimbal at pitch 90 still roundtrips the matrix', () => {
        const m = panoPoseMatrix(40, 90, 0);
        const back = poseFromMatrix(m);
        const m2 = panoPoseMatrix(back.yaw, back.pitch, back.roll);
        for (let i = 0; i < 9; i++) close(m2[i], m[i]);
    });
});

describe('composePoseGesture', () => {
    test('horizontal drag is pure yaw, from any start pose', () => {
        const out = composePoseGesture({yaw: 30, pitch: 0, roll: 0}, {yawDeg: 120, pitchDeg: -10}, {aboutUp: 10});
        close(out.yaw, normalizeYaw(30 - 10));
        close(out.pitch, 0);
        close(out.roll, 0);
    });

    test('vertical drag rotates about the VIEW right axis', () => {
        // Looking north (right = east): positive aboutRight increases pitch.
        const north = composePoseGesture({yaw: 0, pitch: 5, roll: 0}, {yawDeg: 0, pitchDeg: 0}, {aboutRight: 8});
        close(north.pitch, 13, 1e-6);
        close(north.roll, 0, 1e-6);
        // Looking east (right = south = −north): the same world rotation reads
        // as roll, with the opposite sign.
        const east = composePoseGesture({yaw: 0, pitch: 0, roll: 0}, {yawDeg: 90, pitchDeg: 0}, {aboutRight: 8});
        close(east.roll, -8, 1e-6);
        close(east.pitch, 0, 1e-6);
    });

    test('roll about the viewing axis adds up', () => {
        const out = composePoseGesture({yaw: 0, pitch: 0, roll: 3}, {yawDeg: 0, pitchDeg: 0}, {aboutForward: 5});
        close(out.roll, 8, 1e-6);
    });

    test('200 mixed gestures keep the matrix orthonormal (no drift)', () => {
        let pose = {yaw: 12, pitch: 3, roll: -2};
        for (let i = 0; i < 200; i++) {
            pose = composePoseGesture(pose, {yawDeg: (i * 7) % 360, pitchDeg: (i % 40) - 20}, {aboutUp: 0.7, aboutRight: -0.4, aboutForward: 0.2});
        }
        const m = panoPoseMatrix(pose.yaw, pose.pitch, pose.roll);
        const r = [m[0], m[3], m[6]], f = [m[1], m[4], m[7]];
        const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
        close(dot(r, r), 1, 1e-6);
        close(dot(f, f), 1, 1e-6);
        close(dot(r, f), 0, 1e-6);
    });
});

describe('mat3 helpers', () => {
    test('rotation about z matches the yaw-only pose (azimuth convention)', () => {
        const rz = axisRotationMatrix([0, 0, 1], 25);
        const yaw = panoPoseMatrix(25, 0, 0);
        for (let i = 0; i < 9; i++) close(rz[i], yaw[i]);
    });

    test('identity multiply is a no-op', () => {
        const id = axisRotationMatrix([0, 0, 1], 0);
        const m = panoPoseMatrix(77, 12, -4);
        const prod = mat3Multiply(id, m);
        for (let i = 0; i < 9; i++) close(prod[i], m[i]);
    });
});
