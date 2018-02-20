/* slip communication */
const Slip = require('./slip');
/* used for bitmap manipulation */
var bmp = require('bmp-js');
var fs = require('fs');

/* reverse bits in 8 bit word */
function rbit8(x)
{
    /* look up table for bit reversal */
    var lut = [
        0x00, 0x80, 0x40, 0xC0, 0x20, 0xA0, 0x60, 0xE0, 
        0x10, 0x90, 0x50, 0xD0, 0x30, 0xB0, 0x70, 0xF0, 
        0x08, 0x88, 0x48, 0xC8, 0x28, 0xA8, 0x68, 0xE8, 
        0x18, 0x98, 0x58, 0xD8, 0x38, 0xB8, 0x78, 0xF8, 
        0x04, 0x84, 0x44, 0xC4, 0x24, 0xA4, 0x64, 0xE4, 
        0x14, 0x94, 0x54, 0xD4, 0x34, 0xB4, 0x74, 0xF4, 
        0x0C, 0x8C, 0x4C, 0xCC, 0x2C, 0xAC, 0x6C, 0xEC, 
        0x1C, 0x9C, 0x5C, 0xDC, 0x3C, 0xBC, 0x7C, 0xFC, 
        0x02, 0x82, 0x42, 0xC2, 0x22, 0xA2, 0x62, 0xE2, 
        0x12, 0x92, 0x52, 0xD2, 0x32, 0xB2, 0x72, 0xF2, 
        0x0A, 0x8A, 0x4A, 0xCA, 0x2A, 0xAA, 0x6A, 0xEA, 
        0x1A, 0x9A, 0x5A, 0xDA, 0x3A, 0xBA, 0x7A, 0xFA,
        0x06, 0x86, 0x46, 0xC6, 0x26, 0xA6, 0x66, 0xE6, 
        0x16, 0x96, 0x56, 0xD6, 0x36, 0xB6, 0x76, 0xF6, 
        0x0E, 0x8E, 0x4E, 0xCE, 0x2E, 0xAE, 0x6E, 0xEE, 
        0x1E, 0x9E, 0x5E, 0xDE, 0x3E, 0xBE, 0x7E, 0xFE,
        0x01, 0x81, 0x41, 0xC1, 0x21, 0xA1, 0x61, 0xE1, 
        0x11, 0x91, 0x51, 0xD1, 0x31, 0xB1, 0x71, 0xF1,
        0x09, 0x89, 0x49, 0xC9, 0x29, 0xA9, 0x69, 0xE9, 
        0x19, 0x99, 0x59, 0xD9, 0x39, 0xB9, 0x79, 0xF9, 
        0x05, 0x85, 0x45, 0xC5, 0x25, 0xA5, 0x65, 0xE5, 
        0x15, 0x95, 0x55, 0xD5, 0x35, 0xB5, 0x75, 0xF5,
        0x0D, 0x8D, 0x4D, 0xCD, 0x2D, 0xAD, 0x6D, 0xED, 
        0x1D, 0x9D, 0x5D, 0xDD, 0x3D, 0xBD, 0x7D, 0xFD,
        0x03, 0x83, 0x43, 0xC3, 0x23, 0xA3, 0x63, 0xE3, 
        0x13, 0x93, 0x53, 0xD3, 0x33, 0xB3, 0x73, 0xF3, 
        0x0B, 0x8B, 0x4B, 0xCB, 0x2B, 0xAB, 0x6B, 0xEB, 
        0x1B, 0x9B, 0x5B, 0xDB, 0x3B, 0xBB, 0x7B, 0xFB,
        0x07, 0x87, 0x47, 0xC7, 0x27, 0xA7, 0x67, 0xE7, 
        0x17, 0x97, 0x57, 0xD7, 0x37, 0xB7, 0x77, 0xF7, 
        0x0F, 0x8F, 0x4F, 0xCF, 0x2F, 0xAF, 0x6F, 0xEF, 
        0x1F, 0x9F, 0x5F, 0xDF, 0x3F, 0xBF, 0x7F, 0xFF
    ];
    
    /* report result */
    return lut[x] | 0;
}

/* compute parity */
function parity(cmd)
{
	/* compute parity */
	cmd ^= cmd >>> 16;
	cmd ^= cmd >>> 8;
	cmd ^= cmd >>> 4;
	cmd ^= cmd >>> 2;
	cmd ^= cmd >>> 1;

	/* report parity bit */
	return cmd & 0x1;
}

/* append ecc at the end of the command */
function setECC(cmd)
{
    /* convert to number */
    var ecc = 0; c = cmd[0] | cmd[1] << 8 | cmd[2] << 16;
    /* build up the ecc */
    ecc |= parity(c & 0b111100010010110010110111) << 0;
    ecc |= parity(c & 0b111100100101010101011011) << 1;
    ecc |= parity(c & 0b011101001001101001101101) << 2;
    ecc |= parity(c & 0b101110001110001110001110) << 3;
    ecc |= parity(c & 0b110111110000001111110000) << 4;
    ecc |= parity(c & 0b111011111111110000000000) << 5;
    /* store */
    cmd[3] = ecc;
}

/* append crc */
function setCRC(cmd)
{
    /* look-up table for polynomial x^16+x^12+x^5+x^0 */
    var lut = [
        0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7, 
        0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF, 
        0x1231, 0x0210, 0x3273, 0x2252, 0x52B5, 0x4294, 0x72F7, 0x62D6, 
        0x9339, 0x8318, 0xB37B, 0xA35A, 0xD3BD, 0xC39C, 0xF3FF, 0xE3DE, 
        0x2462, 0x3443, 0x0420, 0x1401, 0x64E6, 0x74C7, 0x44A4, 0x5485, 
        0xA56A, 0xB54B, 0x8528, 0x9509, 0xE5EE, 0xF5CF, 0xC5AC, 0xD58D, 
        0x3653, 0x2672, 0x1611, 0x0630, 0x76D7, 0x66F6, 0x5695, 0x46B4, 
        0xB75B, 0xA77A, 0x9719, 0x8738, 0xF7DF, 0xE7FE, 0xD79D, 0xC7BC, 
        0x48C4, 0x58E5, 0x6886, 0x78A7, 0x0840, 0x1861, 0x2802, 0x3823, 
        0xC9CC, 0xD9ED, 0xE98E, 0xF9AF, 0x8948, 0x9969, 0xA90A, 0xB92B, 
        0x5AF5, 0x4AD4, 0x7AB7, 0x6A96, 0x1A71, 0x0A50, 0x3A33, 0x2A12, 
        0xDBFD, 0xCBDC, 0xFBBF, 0xEB9E, 0x9B79, 0x8B58, 0xBB3B, 0xAB1A, 
        0x6CA6, 0x7C87, 0x4CE4, 0x5CC5, 0x2C22, 0x3C03, 0x0C60, 0x1C41, 
        0xEDAE, 0xFD8F, 0xCDEC, 0xDDCD, 0xAD2A, 0xBD0B, 0x8D68, 0x9D49, 
        0x7E97, 0x6EB6, 0x5ED5, 0x4EF4, 0x3E13, 0x2E32, 0x1E51, 0x0E70, 
        0xFF9F, 0xEFBE, 0xDFDD, 0xCFFC, 0xBF1B, 0xAF3A, 0x9F59, 0x8F78, 
        0x9188, 0x81A9, 0xB1CA, 0xA1EB, 0xD10C, 0xC12D, 0xF14E, 0xE16F, 
        0x1080, 0x00A1, 0x30C2, 0x20E3, 0x5004, 0x4025, 0x7046, 0x6067, 
        0x83B9, 0x9398, 0xA3FB, 0xB3DA, 0xC33D, 0xD31C, 0xE37F, 0xF35E, 
        0x02B1, 0x1290, 0x22F3, 0x32D2, 0x4235, 0x5214, 0x6277, 0x7256, 
        0xB5EA, 0xA5CB, 0x95A8, 0x8589, 0xF56E, 0xE54F, 0xD52C, 0xC50D, 
        0x34E2, 0x24C3, 0x14A0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 
        0xA7DB, 0xB7FA, 0x8799, 0x97B8, 0xE75F, 0xF77E, 0xC71D, 0xD73C, 
        0x26D3, 0x36F2, 0x0691, 0x16B0, 0x6657, 0x7676, 0x4615, 0x5634, 
        0xD94C, 0xC96D, 0xF90E, 0xE92F, 0x99C8, 0x89E9, 0xB98A, 0xA9AB, 
        0x5844, 0x4865, 0x7806, 0x6827, 0x18C0, 0x08E1, 0x3882, 0x28A3, 
        0xCB7D, 0xDB5C, 0xEB3F, 0xFB1E, 0x8BF9, 0x9BD8, 0xABBB, 0xBB9A, 
        0x4A75, 0x5A54, 0x6A37, 0x7A16, 0x0AF1, 0x1AD0, 0x2AB3, 0x3A92, 
        0xFD2E, 0xED0F, 0xDD6C, 0xCD4D, 0xBDAA, 0xAD8B, 0x9DE8, 0x8DC9, 
        0x7C26, 0x6C07, 0x5C64, 0x4C45, 0x3CA2, 0x2C83, 0x1CE0, 0x0CC1, 
        0xEF1F, 0xFF3E, 0xCF5D, 0xDF7C, 0xAF9B, 0xBFBA, 0x8FD9, 0x9FF8, 
        0x6E17, 0x7E36, 0x4E55, 0x5E74, 0x2E93, 0x3EB2, 0x0ED1, 0x1EF0 
    ];

    /* initial crc value */
    var crc = 0xffff;
    /* go over command */
    for (var i = 0; i < cmd.byteLength - 2; i++)
        crc = ((crc << 8) ^ lut[(crc >>> 8) ^ rbit8(cmd[i])]) & 0xffff;

    /* append */
    cmd[cmd.length - 2] = rbit8((crc >> 8) & 0xff); 
    cmd[cmd.length - 1] = rbit8(crc & 0xff);
}

/* append initialization sequence */
function setInitialization(buf, offset)
{
    /* standard initialization sequence */
    var initSeq = Buffer.from([
        /* display on */
        0x15, 0x29, 0x00, 0x0F,
        /* exit sleep mode */
        0x15, 0x11, 0x00, 0x25,
        /* 24bpp */
        0x15, 0x3A, 0x77, 0x1F
    ]);
    /* store information */
    initSeq.copy(buf, offset);
    /* return new offset */
    return offset + initSeq.byteLength;
}

/* set drawing window */
function setDrawingWindow(buf, offset, x1, y1, x2, y2)
{
    /* set row and set column commands */
    var window = Buffer.from([
        /* set column address */
        0x29, 0x05, 0x00, 0x25, 
        0x2A, 
        /* x coords */
        (x1 >>> 8) & 0xff, x1 & 0xff, (x2 >>> 8) & 0xff, x2 & 0xff, 
        /* crc */
        0x00, 0x00,
        
        /* set row address */
        0x29, 0x05, 0x00, 0x25, 
        0x2b, 
        /* x coords */
        (y1 >>> 8) & 0xff, y1 & 0xff, (y2 >>> 8) & 0xff, y2 & 0xff,
        /* crc */
        0x00, 0x00,
    ]);
    /* set crc values */
    setCRC(window.slice(4, 11));
    setCRC(window.slice(15));
    
    /* store information */
    window.copy(buf, offset);
    /* return new offset */
    return offset + window.byteLength;
}

/* sets write data command in buffer */
function setWriteData(buf, offset, data, cont)
{
    /* data size in octets */
    var size = data.length + 1;
    /* write command */
    var write = Buffer.from([
        /* prepare write command */
        0x39, size & 0xff, (size >>> 8) & 0xff, 0x00,
        /* start from the beginning of the drawing window or
         * continue */
        !cont ? 0x3c : 0x2c
        /* data goes here */
    ]);
    /* crc (dummy, not checked) */
    var crc = Buffer.from([0xff, 0xff]);
    
    /* set ecc */
    setECC(write.slice(0, 4));
    
    /* store information */
    write.copy(buf, offset);
    data.copy(buf, offset + write.byteLength);
    crc.copy(buf, offset + write.byteLength + data.byteLength);
    /* return new offset */
    return offset + write.byteLength + data.byteLength + crc.byteLength;
}

/* return binary bitmap data */
function extractBitmapData(fileName)
{
    var bmpBuffer = fs.readFileSync(fileName);
    /* decode file */
    var img = bmp.decode(bmpBuffer);
    /* current offset */
    var size = img.width * img.height;
    /* bmp-js produces 32bpp data, we need 24bpp */
    var data = Buffer.allocUnsafe(size * 3);
    
    /* extract data */
    for (var j = 0, i = 0; i < size; i++) {
        data[j++] = img.data[i*4 + 0];
        data[j++] = img.data[i*4 + 1];
        data[j++] = img.data[i*4 + 2];
    }
    
    /* return binary array */
    return data;
}

/* display bitmap on the screen */
function displayBitmap(data, callback)
{
    /* current offset */
    var offset = 0; var chunkMaxSize = 3*240*4;
    /* allocate buffer (size for data and some command bytes) */
    var buf = Buffer.allocUnsafe(chunkMaxSize + 10);
    
    /* function writes a single chunk */
    var writeChunk = () => {
        /* number of bytes to send: we use 3bytes per pixel and no 
         * trucated pixels are allowed */
        var chunkSize = Math.min(chunkMaxSize, data.byteLength - offset);
        /* done sending? */
        if (chunkSize == 0)
            return callback();
       
        /* store command in buffer */    
        var bufLen = setWriteData(buf, 0, 
            data.slice(offset, offset + chunkSize), offset == 0);
        //console.log(bufLen);
        /* update offset counter */
        offset += chunkSize;
        /* start writing */
        slip.write(buf.slice(0, bufLen), writeChunk);
    };
    
    /* start writing */
    writeChunk();
}

/* show multiple images */
function slideshow(files)
{
    /* image counter */
    var i = 0;
    /* image data */
    var data = [];
    
    /* convert bitmaps */
    for (var j = 0; j < files.length; j++)
        data.push(extractBitmapData(files[j]));
    
    /* image upload loop */
    var imageUploaded = () => {
        /* proceed with current bitmap */
        displayBitmap(data[i], imageUploaded)
        /* roll-over */
        if (++i >= files.length)
            i = 0;
    };
    
    /* start process */
    imageUploaded();
}

/* open serial port for slip communication */
var slip = new Slip({ portName : 'COM9', baudRate : 2766400/*4160000*/});
/* serial port opened? */
slip.once('open', () => { 
    /* make sure that we start from clean frame signal */
    var flushing = Buffer.from([0]);
    /* start with flushing */
    slip.write(flushing);
    
    /* empty command buffer */
    var cmd = Buffer.allocUnsafe(10);
    /* let's build up the commands */
    var cmdLen = setInitialization(cmd, 0);
    /* send initialization commands */
    slip.write(cmd.slice(0, cmdLen), () => {
        slideshow(['test1.bmp', 'test2.bmp', 'test3.bmp']);
    });
});