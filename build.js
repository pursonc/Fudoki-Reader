const fs = require('fs-extra');
const path = require('path');
const Terser = require('terser');
const archiver = require('archiver');

const EXTENSION_DIR = path.join(__dirname, 'extension');
const DIST_DIR = path.join(__dirname, 'dist');
const BUILD_DIR = path.join(DIST_DIR, 'unpacked');

async function build() {
  console.log('🚀 Starting build process...');

  // 1. Clean and create dist directory
  await fs.remove(DIST_DIR);
  await fs.ensureDir(BUILD_DIR);

  // 2. Copy extension files to build directory
  console.log('📂 Copying files...');
  await fs.copy(EXTENSION_DIR, BUILD_DIR);

  // 3. Read manifest to get version
  const manifest = await fs.readJson(path.join(BUILD_DIR, 'manifest.json'));
  const version = manifest.version;
  console.log(`ℹ️  Version: ${version}`);

  // 4. Minify JS files
  console.log('🔨 Minifying JS files...');
  const files = await getFiles(BUILD_DIR);
  
  for (const file of files) {
    if (path.extname(file) === '.js' && !file.endsWith('.min.js')) {
      // Skip minifying libs if they look like libraries or are large/complex and might break
      // For now, we minify everything that isn't .min.js
      // You might want to exclude specific paths if needed
      
      try {
        const code = await fs.readFile(file, 'utf8');
        const result = await Terser.minify(code, {
          compress: {
            drop_console: true, // Optional: remove console logs
            drop_debugger: true
          },
          mangle: true
        });

        if (result.code) {
          await fs.writeFile(file, result.code);
          console.log(`   ✅ Minified: ${path.relative(BUILD_DIR, file)}`);
        } else if (result.error) {
          console.error(`   ❌ Error minifying ${path.relative(BUILD_DIR, file)}:`, result.error);
        }
      } catch (err) {
        console.error(`   ❌ Failed to process ${path.relative(BUILD_DIR, file)}:`, err.message);
      }
    }
  }

  // 5. Create ZIP file
  const zipName = `fudoki-reader-v${version}.zip`;
  const zipPath = path.join(DIST_DIR, zipName);
  console.log(`📦 Creating ZIP package: ${zipName}...`);

  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', function() {
    console.log(`\n✨ Build complete!`);
    console.log(`📁 Output: ${zipPath}`);
    console.log(`📊 Total size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
  });

  archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
      console.warn(err);
    } else {
      throw err;
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);
  archive.directory(BUILD_DIR, false);
  await archive.finalize();
}

async function getFiles(dir) {
  const subdirs = await fs.readdir(dir);
  const files = await Promise.all(subdirs.map(async (subdir) => {
    const res = path.resolve(dir, subdir);
    return (await fs.stat(res)).isDirectory() ? getFiles(res) : res;
  }));
  return files.reduce((a, f) => a.concat(f), []);
}

build().catch(console.error);
