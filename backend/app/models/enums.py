"""Catálogos (enums) compartidos entre modelos y esquemas."""
from enum import Enum


class Role(str, Enum):
    EMPRESA = "empresa"          # representante de una empresa
    UNIVERSIDAD = "universidad"  # oficina de vinculación / transferencia
    ESTUDIANTE = "estudiante"
    ACADEMICO = "academico"      # profesor o investigador (asesor)
    GOBIERNO = "gobierno"        # municipio o dependencia
    ADMIN = "admin"


class OrgType(str, Enum):
    EMPRESA = "empresa"
    UNIVERSIDAD = "universidad"
    GOBIERNO = "gobierno"


class OrgSize(str, Enum):
    MICRO = "micro"
    PEQUENA = "pequena"
    MEDIANA = "mediana"
    GRANDE = "grande"
    STARTUP = "startup"
    COOPERATIVA = "cooperativa"


class CapabilityType(str, Enum):
    LABORATORIO = "laboratorio"
    EQUIPO = "equipo"
    EXPERTO = "experto"
    SERVICIO = "servicio"


class ChallengeStatus(str, Enum):
    BORRADOR = "borrador"
    ABIERTO = "abierto"
    EN_PROGRESO = "en_progreso"
    FINALIZADO = "finalizado"
    CANCELADO = "cancelado"


class Confidentiality(str, Enum):
    PUBLICO = "publico"
    CONFIDENCIAL = "confidencial"  # requiere aceptar NDA para ver el detalle


class IPModel(str, Enum):
    EMPRESA = "empresa"
    UNIVERSIDAD = "universidad"
    COMPARTIDA = "compartida"
    ABIERTA = "abierta"  # resultados de libre uso


class Modality(str, Enum):
    RESIDENCIA = "residencia"
    SERVICIO_SOCIAL = "servicio_social"
    TESIS = "tesis"
    PROYECTO_CLASE = "proyecto_clase"
    CONSULTORIA = "consultoria"


class TeamRole(str, Enum):
    LIDER = "lider"
    INTEGRANTE = "integrante"
    ASESOR = "asesor"


class ProposalStatus(str, Enum):
    ENVIADA = "enviada"
    ACEPTADA = "aceptada"
    RECHAZADA = "rechazada"
    RETIRADA = "retirada"


class MilestoneStatus(str, Enum):
    PENDIENTE = "pendiente"
    ENTREGADO = "entregado"
    APROBADO = "aprobado"
    CAMBIOS = "cambios_solicitados"
