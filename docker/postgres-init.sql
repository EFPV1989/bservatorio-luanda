-- Base de dados dos testes funcionais da API (o nome tem de terminar em "_test").
CREATE DATABASE observatorio_test OWNER observatorio;
\connect observatorio_test
CREATE EXTENSION IF NOT EXISTS postgis;
