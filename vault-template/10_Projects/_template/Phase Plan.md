---
type: phase_plan
project: {project}
phase: {phase}
status: active
allowed_files:
  - {file}
sensitive_files:
  - {file, only if it touches auth/payment/deploy/db/dependency-install/destructive -- see senpai.config.yaml's require_approval_for. Leave the list empty if nothing in allowed_files qualifies.}
verification_commands:
  - {command}
---

# Phase Plan

## 목표

## 이번에 할 것

## 이번에 하지 않을 것

## 작업 체크리스트

- [ ]

## 완료 증거

- [ ]

## 승인 상태

- [ ] 사용자가 범위를 이해함
- [ ] 사용자가 진행을 승인함
