import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { GroupService } from '../../../core/services/group.service';

@Component({
  selector: 'app-group-create-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ModalComponent],
  templateUrl: './group-create-modal.component.html',
  styleUrl: './group-create-modal.component.css'
})
export class GroupCreateModalComponent {
  @Input() isOpen = false;
  @Output() closeModal = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private groupService = inject(GroupService);

  public emojiPresets = ['✈️', '🍕', '🍜', '🍷', '🏖️', '🎒', '🏰', '🍣', '🍦', '☕', '🏕️', '🌮', '🍸', '🏔️', '🚂', '🥐'];
  public colorPresets = ['#f97316', '#4f46e5', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4', '#d97706'];

  public groupForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    icon: ['🍕', Validators.required],
    color: ['#f97316', Validators.required]
  });

  onClose(): void {
    this.groupForm.reset({
      name: '',
      description: '',
      icon: '🍕',
      color: '#f97316'
    });
    this.closeModal.emit();
  }

  onSubmit(): void {
    if (this.groupForm.invalid) return;

    const val = this.groupForm.value;
    this.groupService.createGroup({
      name: val.name!,
      description: val.description || '',
      icon: val.icon || '✈️',
      color: val.color || '#4f46e5'
    });

    this.onClose();
  }
}
