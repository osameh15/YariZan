FROM php:8.4-apache
RUN docker-php-ext-install pdo_mysql \
    && sed -i 's|/var/www/html|/var/www/html/public|g' /etc/apache2/sites-available/000-default.conf \
    && printf '<Directory /var/www/html/public>\nAllowOverride All\nRequire all granted\n</Directory>\n' > /etc/apache2/conf-available/yarizan.conf \
    && a2enconf yarizan
WORKDIR /var/www/html
