#!/bin/bash

#this script update the www/mmaraka.com site

sudo cp -R backend /var/www/mmakara.com/
sudo cp -R frontend /var/www/mmakara.com/

sudo chown -R joe:joe /var/www/mmaraka.com/frontend
cd /var/www/mmaraka.com/frontend
rm -rf dist && npm run build
sudo systemctl reload apache2

cd /var/www/mmaraka.com/backend
npm install

sudo chown -R www-data:www-data /var/www/mmaraka.com/frontend
sudo chmod -R 755 /var/www/mmaraka.com/frontend
sudo systemctl reload apache2

pm2 restart 0

