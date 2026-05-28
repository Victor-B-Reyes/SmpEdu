# Etapa 1: Construcción (Build)
FROM node:20-alpine AS build
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código y construir
COPY . .
RUN npm run build --configuration=production

# Etapa 2: Servidor de producción (Nginx)
FROM nginx:alpine
# Nota: Ajusta 'smp-edu/browser' según el nombre de tu proyecto en angular.json
COPY --from=build /app/dist/SmpEdu/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]